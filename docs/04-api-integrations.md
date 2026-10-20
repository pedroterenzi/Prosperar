# SaaS V2 — APIs, Serverless Functions e Integrações

> Stack: **Supabase** (Postgres + Auth + Edge Functions) · Frontend **Next.js 14**. Toda escrita passa por Edge Functions usando `service_role` (RLS nunca é a única defesa em endpoints públicos).

---

## 1. REST / Edge Functions — Rotas vitais

### Auth (Supabase Auth nativo)
```
POST /auth/v1/otp/request   { phone }                  # cliente: WhatsApp OTP
POST /auth/v1/otp/verify    { phone, token }           # devolve JWT (role=client)
POST /auth/v1/token?grant_type=password               # staff: e-mail+senha
```
Client = OTP por telefone (sem senha). Staff = e-mail + senha forte (bcrypt no Supabase Auth), MFA opcional para `owner`.

### Público (Edge Functions — service_role, sem JWT)
```
GET  /functions/v1/org?slug={slug}
       → { org, services[], professionals[] }           # catálogo

GET  /functions/v1/slots?org={id}&professional={id|any}&date=YYYY-MM-DD&service={id}
       → { slots: [timestamptz...] }                    # usa get_available_slots(); cache 30s

POST /functions/v1/appointments
       body: { org, service_id, professional_id|any, start_at, phone, name?, marketing_optin }
       → { reschedule_token, appointment }
       fluxo interno:
         1. upsert customer (org_id+phone)
         2. INSERT appointment (EXCLUDE constraint garante slot único;
            409 → retorna os 3 próximos slots livres para retry)
         3. enfileira notificação: template appt_confirm → WhatsApp
         4. retorna token mágico

GET  /functions/v1/appointments/{reschedule_token}      # sem autenticação
PATCH /functions/v1/appointments/{reschedule_token}/reschedule  { start_at, professional_id? }
DELETE /functions/v1/appointments/{reschedule_token}    { reason? }
```

### Staff (JWT + role staff/owner, validado por policy)
```
GET    /rest/v1/appointments?date=eq.{d}&status=in.(...)   # Supabase REST + RLS
PATCH  /rest/v1/appointments/{id}/status                   # { status } → trigger audita
POST   /rest/v1/orders                                     # abre comanda da reserva
POST   /rest/v1/order_items                                # serviço/produto/crédito
POST   /functions/v1/checkout                              # { order_id, method }
         PIX   → cria payment no gateway → { qr_code, ticket_id } → polling
         cash/pos → PATCH transactions status=paid (manual)
GET    /rest/v1/rpc/customer_credit_balance?p_customer=    # saldo do clube
GET    /rest/v1/rpc/customer_points_balance?p_customer=
POST   /rest/v1/time_off
GET    /rest/v1/rpc/get_available_slots(...)
```

### Owner (JWT + role=owner)
```
GET    /functions/v1/dashboard?period=&professional=       # agregado pré-calculado
         → { revenue_net, occupancy_pct, ticket, noshow_pct,
             by_professional[], daily_series[], top_customers[] }
GET    /functions/v1/reports/commissions?period=2026-10    # CSV/OFX
POST   /rest/v1/commissions/{ids}/mark-paid                # fechamento do período
CRUD   /rest/v1/services | professionals | products | plans | availability_rules
CRUD   /rest/v1/expenses
POST   /functions/v1/campaigns                             # { segment, template, coupon? }
GET    /rest/v1/notifications?org=...                       # log de entregas
```

### Webhooks (endpoints aceitam apenas assinatura válida)
```
POST /functions/v1/webhooks/payments/{provider}            # mercadopago | asaas
POST /functions/v1/webhooks/whatsapp/{provider}            # status de entrega
```

---

## 2. Lógica de Webhook — Gateway de Pagamento

```ts
// supabase/functions/webhooks/payments/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';

export default async (req: Request) => {
  const provider = req.url.split('/').pop();           // 'mercadopago' | 'asaas'
  const body = await req.json();

  // 1) ASSINATURA — nunca confie no corpo
  if (!(await verifySignature(req, provider))) return new Response('invalid', { status: 401 });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SERVICE_ROLE_KEY')!);
  const { eventId, orderId, status, gross, fee, method } = parseProvider(provider, body);

  // 2) IDEMPOTÊNCIA — o banco é o guardião (gateway_id UNIQUE)
  const { data: existing } = await db.from('transactions')
      .select('id').eq('gateway_id', eventId).maybeSingle();
  if (existing) return Response.json({ received: true }); // reentrega do gateway → ok

  // 3) PERSISTIR — taxa REAL registrada, não estimada
  await db.from('transactions').insert({
    org_id: (await db.from('orders').select('org_id').eq('id', orderId).single()).data.org_id,
    order_id: orderId, method, gross, fee,
    status: status === 'approved' ? 'paid' : 'failed',
    gateway: provider, gateway_id: eventId,
    paid_at: status === 'approved' ? new Date() : null,
  });
  // 4) O trigger fn_on_payment (SQL) faz o resto:
  //    → congela comissões de cada item de serviço (rate do profissional vigente)
  //    → soma LTV/visitas do cliente, concede pontos, fecha a comanda
  // 5) Dispara template 'payment_receipt' → WhatsApp do cliente
  return Response.json({ received: true });
};
```

**Regras:**
- Reentrega automática dos gateways (até 24h) → idempotência obrigatória.
- `status: 'pending'` no INSERT + polling do frontend a cada 4s (máx. 2min) enquanto a tela de QR está aberta.
- Chargeback/refund: provider envia novo evento → `status='refunded'` → estorna comissão via `INSERT` negativo no ledger (nunca UPDATE).
- Mercado Pago: evento `payment.approved`. Asaas: `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED`. Assinaturas: `PAYMENT_SCHEDULED` cria transação futura pendente.

---

## 3. Lógica de Notificação WhatsApp (lembretes automáticos)

### Motor de lembretes (cron a cada 5 min)
```ts
// supabase/functions/reminder-worker/index.ts  — chamado por pg_cron
export default async () => {
  const db = serviceClient();

  // 1) busca lembretes vencidos e pendentes
  const { data: due } = await db.rpc('claim_due_reminders');  -- FOR UPDATE SKIP LOCKED
  for (const r of due) {
    const appt = await loadAppointment(r.appointment_id);      // join org/customer/prof
    if (appt.status !== 'confirmed') continue;                 // cancelou? descarta

    // 2) janela de silêncio 22h–8h (timezone da org) — salva e reagenda
    if (inQuietHours(appt.org.timezone)) { rescheduleToMorning(r); continue; }

    // 3) template com botões interativos
    const sent = await sendWhatsApp({
      to: appt.customer.phone,
      template: r.template === 'reminder_24h' ? REMINDER_24H : REMINDER_2H,
      variables: [appt.professional.full_name, appt.service_name,
                  formatBrDate(appt.start_at), appt.reschedule_token],
      buttons: [
        { id: 'confirm', label: 'Confirmar' },
        { id: 'reschedule', label: 'Reagendar', url: `${APP}/a/${appt.reschedule_token}` },
        { id: 'cancel', label: 'Cancelar' },
      ],
    });

    // 4) auditoria real (delivery status chega via webhook depois)
    await db.from('notifications').insert({ org_id: appt.org_id, customer_id: appt.customer_id,
      template: r.template, status: sent ? 'sent' : 'failed',
      payload: { message_id: sent?.id } });
    await db.from('reminder_queue').update({ sent_at: new Date() }).eq('id', r.id);
  }
};
```

### Provedores (camada de abstração)
| Camada | MVP | Escala |
|---|---|---|
| Transporte | **Evolution API** (self-host, custo ~0) ou **Z-API** | **Meta Cloud API** oficial (verificação de negócio) |
| Fallback | Retry 3× → SMS Twilio se opt-in | mesmo |
| Templates aprovados | `appt_confirm`, `reminder_24h`, `reminder_2h`, `appt_rescheduled`, `appt_cancelled`, `payment_receipt`, `evaluation_request`, `winback_21d`, `club_renewal` | + campanhas por segmento |

**Limites operacionais:**
- Rate: fila com concorrência 5, backoff exponencial (1s → 4s → 16s).
- `webhooks/whatsapp` recebe `delivered`/`read`/`failed` → atualiza `notifications.status`.
- Opt-out: comando "SAIR" detectado → `allows_marketing=false` (transacionais continuam).
- Quiet hours + regra anti-spam: máx. 1 transacional + 1 marketing por cliente por semana.

---

## 4. Integrações externas — definição final

| Serviço | Papel | Alternativa |
|---|---|---|
| **Supabase** | Postgres+RLS, Auth OTP, Edge Functions, Realtime, Storage | — |
| **Mercado Pago** | PIX + cartão + QR dinâmico (checkout transparente) | **Asaas** (melhor split para comissão + recorrência) |
| **Asaas** | Assinaturas do Clube (débito automático/boleto/PIX) | Mercado Pago Preapproval |
| **Evolution API** | WhatsApp transacional | Z-API → Meta Cloud API |
| **Twilio** | SMS fallback | Vonage |
| **Resend** | E-mail transacional (recibo, relatórios) | AWS SES |
| **Sentry** | Erros frontend/backend | — |
| **PostHog** | Funil de agendamento, ativação, retenção (product analytics) | Plausible + Metabase |
| **Vercel** | Host Next.js + edge | — |

---

## 5. Segurança (não-negociável vs V1)

1. RLS ativa em **todas** as tabelas (0001_initial_schema.sql) — banco impede cross-tenant.
2. Webhooks: assinatura HMAC verificada + idempotência por `gateway_id UNIQUE`.
3. `service_role` só em Edge Functions — nunca no bundle do browser.
4. OTP: 6 dígitos, expira 5min, máx. 3 envios/hora por telefone (rate-limit).
5. Credenciais apenas em `supabase secrets` / env vars — **nunca commitadas** (lição do V1).
6. Senhas de staff: bcrypt (Supabase Auth) + MFA TOTP obrigatório para `owner`.
7. Audit trail completo: `appointment_events` + `notifications` + `transactions` imutáveis.
8. Backup: PITR do Supabase + dump diário agendado para storage.
