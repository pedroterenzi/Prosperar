# SaaS V2 Premium — Barbearia SaaS (Multi-tenant)

Reconstrução completa do "Prosperar Club" (SaaS base analisado) como SaaS premium: zero-fricção para o cliente, comissão em tempo real para o barbeiro e decisões em 5 segundos para o dono.

## Estrutura do projeto

```
saas-v2/
├── app/                             ← Next.js 14 (App Router, mobile-first)
│   ├── b/[slug]/page.tsx            ← Rota pública /b/demo (tela do cliente)
│   ├── auth/                        ← login, sign-up, callback, signup-barbershop
│   ├── app/                         ← módulos autenticados
│   │   ├── page.tsx                 ← despachante por papel (redirect)
│   │   ├── admin/{dashboard,products,settings}/page.tsx
│   │   ├── barber/{agenda,dashboard,retention}/page.tsx
│   │   └── client/{history,loyalty,shop}/page.tsx
│   ├── layout.tsx                   ← Tema dark/light do design system
│   └── globals.css                  ← Tokens CSS (grafite/ouro) + componentes
├── middleware.ts                    ← Sessão + guarda de rota por role
├── vercel.json                      ← Config de deploy (região gru1, headers)
├── components/
│   ├── booking/                     ← Tela Zero Friction (3 toques)
│   │   ├── BookingFlow.tsx          ← Máquina de estados service→slot→confirm→done
│   │   ├── ServicePicker.tsx        ← Tela 1: serviços + profissionais
│   │   ├── DateTimePicker.tsx       ← Tela 2: carrossel 14 dias + slots por turno
│   │   └── ConfirmSheet.tsx         ← Tela 3: resumo + OTP WhatsApp + confirmar
│   ├── app/{AppShell,ui}.tsx        ← Casca (nav por papel) + componentes de UI
│   ├── auth/AuthShell.tsx           ← Moldura das telas de autenticação
│   └── barber/ComandaSheet.tsx      ← Comanda: abrir/somar/fechar + anotação
├── lib/
│   ├── supabase/{client,server}.ts  ← Clientes browser (@supabase/ssr) e servidor
│   ├── api/{admin,barber,client,onboarding,session,types}.ts ← Camada de dados
│   └── booking/{api,types,format}.ts ← RPCs, tipos e formatação pt-BR
├── supabase/
│   └── migrations/
│       ├── 0001_core_schema.sql     ← DDL: tabelas, ENUMs, FKs, índices,
│       │                              anti double-booking (EXCLUDE), triggers
│       │                              (snapshot, auditoria, comissões, LTV)
│       ├── 0002_rls_and_public_api.sql ← RLS multi-tenant, helpers, funções
│       │                                    públicas de catálogo/slots e bootstrap
│       ├── 0003_book_appointment.sql ← RPC de agendamento (OTP → INSERT em
│       │                              appointments com slot único garantido)
│       ├── 0004_demo_seed.sql        ← Seed demo (slug "demo", catálogo, expediente)
│       ├── 0005_demo_cleanup.sql     ← Remove o seed duplicado
│       ├── 0006_app_modules.sql      ← Produtos, comanda, dashboards, fidelidade,
│       │                              retenção, reservas e onboarding multi-tenant
│       └── 0007_fix_auth_trigger.sql ← handle_new_user defensivo + create_barbershop
└── docs/
    ├── 02-ux-flows.md                ← Telas e fluxos: cliente (3 toques),
    │                                    barbeiro (Hoje/Comanda/Extrato), gestor
    ├── 03-design-system.md           ← Tokens (dark grafite/ouro), tipografia,
    │                                    componentes, microinterações
    ├── 04-api-integrations.md        ← Rotas REST/Edge, webhooks de pagamento
    │                                    (idempotência) e WhatsApp (lembretes)
    └── 05-roadmap.md                 ← 5 sprints até MVP cobrando + pós-MVP
```

## Rotas e papéis

| Rota | Papel | Descrição |
|---|---|---|
| `/b/[slug]` | público | Agendamento em 3 toques (OTP WhatsApp) |
| `/auth/login` | público | E-mail + senha **ou** Magic Link |
| `/auth/sign-up` | público | Cadastro do cliente (via slug da barbearia) |
| `/auth/signup-barbershop` | autenticado | Onboarding do gestor (cria a org) |
| `/app/admin/*` | `owner`, `receptionist` | Dashboard, produtos, ajustes |
| `/app/barber/*` | `barber` | Agenda + comanda, ganhos, retenção |
| `/app/client/*` | `client` | Histórico, fidelidade, loja |

O `middleware.ts` valida a sessão e o `public.profiles.role`, redirecionando
cada papel para a sua casa: `owner`/`receptionist` → `/app/admin/dashboard`,
`barber` → `/app/barber/agenda`, `client` → `/app/client/history`.
Usuário autenticado sem `org_id` cai em `/auth/signup-barbershop`.


## Como começar

1. Criar projeto Supabase → aplicar as migrações (nesta ordem):
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```
   No SQL Editor: colar e rodar na ordem `0001_core_schema.sql`,
   `0002_rls_and_public_api.sql`, `0003_book_appointment.sql`,
   `0004_demo_seed.sql` (arquivos pequenos separados para colagem segura).
2. Criar a primeira org + usuário owner (SQL editor):
   ```sql
   insert into public.organizations (name, slug)
   values ('Minha Barbearia', 'minha');
   -- depois signup via UI com role=owner e org_id da org acima
   ```
3. `supabase secrets set` para: `MERCADO_PAGO_TOKEN`, `EVOLUTION_API_KEY`, `APP_URL`.
4. Seguir a Sprint 0 do `docs/05-roadmap.md`.

## Rodando a tela de agendamento (Zero Friction)

```bash
cd saas-v2
cp .env.local.example .env.local   # preencha URL e anon key do Supabase
npm install
npm run dev                        # http://localhost:3000/b/demo
```

### Teste de integração (banco real)

```bash
node scripts/integration-test.mjs
```

O script valida contra o projeto configurado no `.env.local`: RPC `get_org_by_slug`,
`get_public_catalog`, `get_available_slots`, RLS negando leitura direta de
`services`/`appointments` ao anônimo e `book_appointment` recusando sem OTP.

**Resultado da última execução (2026-10-20):**

| Teste | Resultado |
|---|---|
| `get_org_by_slug('demo')` | ✅ Prosperar Club |
| `get_public_catalog` | ✅ 4 serviços (108 linhas — seed duplicado, ver abaixo) |
| `get_available_slots` | ✅ 40 slots/dia calculados |
| RLS leitura direta (services/appointments) | ✅ negada ao anônimo |
| `book_appointment` sem OTP | ⚠️ função ausente — migration `0003` não aplicada |

### Pendências no banco (SQL Editor, colar na ordem)

1. **`0003_book_appointment.sql`** — nunca foi aplicada; sem ela a confirmação
   de agendamento falha (RPC `book_appointment` inexistente).
2. **`0005_demo_cleanup.sql`** — o seed `0004` foi colado 3× (12 serviços e 9
   profissionais duplicados no catálogo); a migration remove os duplicados.
3. **`0006_app_modules.sql`** — RPCs e tabelas dos módulos autenticados
   (comanda, dashboards, fidelidade, retenção, reservas). Sem ela, `/app/*`
   falha ao chamar as RPCs.
4. **`0007_fix_auth_trigger.sql`** — corrige o `Database error saving new user`
   tornando o `handle_new_user()` defensivo (defaults seguros para `full_name`,
   `phone`, `role` e `org_id`) e reforça o `create_barbershop()` para vincular
   o gestor como `owner` de uma nova organização.
5. **Telefone**: ative o provedor em *Authentication → Providers → Phone* e
   cadastre um OTP de teste (ex.: `+5511999990000` → `123456`). Sem isso o envio
   de código retorna `Unsupported phone provider`.

- **Catálogo/agenda** funcionam anônimos (RPCs públicas). O **agendamento**
  exige OTP de telefone (no app real, o código chega por WhatsApp/SMS).
- Roteiro de teste: `/b/demo` → *Corte Simples* → *Continuar* → horário →
  *Confirmar* → nome + WhatsApp → código → *Confirmar agendamento*. Na segunda
  reserva do mesmo aparelho o código não é pedido (sessão persistente).
- Corrida de horário: se alguém ocupar o slot entre a lista e o toque final,
  a RPC levanta `slot_unavailable`, a UI avisa e recarrega os slots.
- Recursos "vivos": transições Framer Motion entre etapas, carrossel de dias
  arrastável com marcadores hoje/amanhã/fds, filtro de turnos instantâneo,
  badge dourado de escassez ("Poucos horários restantes para hoje") e
  comprovante tipo ticket com Google Agenda, `.ics` e WhatsApp.
- Verificações: `npm run typecheck` · `npm run build`.

## Diferenças fundamentais vs SaaS base

| Base (V1) | V2 |
|---|---|
| Senhas em texto plano, API sem auth | Supabase Auth (OTP), RLS em todas as tabelas |
| Relações por nome em texto | FKs reais + snapshots imutáveis |
| Datas em VARCHAR | `timestamptz` + timezone da org |
| Double-booking possível | `EXCLUDE` constraint no Postgres |
| "Notificação" = abrir wa.me manual | Fila de lembretes T-24h/T-2h + webhook de entrega |
| Pagamento = mostrar chave PIX | Gateway real (MP/Asaas), taxa líquida registrada |
| LTV = número mágico 62 | LTV por trigger sobre transações pagas |
| Single-tenant | `org_id` + RLS desde o dia 1 |

## Publicação em produção (Vercel + Supabase)

### 1. Variáveis de ambiente (Vercel → Project → Settings → Environment Variables)

Cadastre para **Production**, **Preview** e **Development**:

| Nome | Onde pegar | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | público |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public | público, protegido por RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role | **secreto** — marque "Sensitive" |
| `NEXT_PUBLIC_SITE_URL` | URL do deploy (ex.: `https://app.suabarbearia.com.br`) | usado nos redirects de Magic Link |

> Nunca prefixe a service role com `NEXT_PUBLIC_`: ela ignora o RLS.

### 2. Deploy

**Via CLI:**

```bash
npm i -g vercel
vercel login
vercel link                 # associa a pasta ao projeto
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add NEXT_PUBLIC_SITE_URL
vercel --prod
```

**Via Git:** importe o repositório em *vercel.com/new*, defina o **Root Directory**
como `saas-v2`, cadastre as variáveis acima e faça push — o build roda sozinho.

### 3. DNS (domínio próprio)

1. Vercel → Project → Settings → Domains → **Add** → `app.suabarbearia.com.br`.
2. No provedor do domínio (Registro.br, Cloudflare, GoDaddy…):

   | Tipo | Nome | Valor |
   |---|---|---|
   | `A` | `app` (ou `@` para a raiz) | `76.76.21.21` |
   | `CNAME` | `www` | `cname.vercel-dns.com` |

   A Vercel mostra o valor exato no painel — use o que aparecer lá.
3. Aguarde a propagação (5 min a 24 h). A Vercel emite o TLS automaticamente.

### 4. Configurar o Supabase para o domínio de produção

Em **Authentication → URL Configuration**:
- **Site URL**: `https://app.suabarbearia.com.br`
- **Redirect URLs**: adicione `https://app.suabarbearia.com.br/auth/callback`
  e `https://app.suabarbearia.com.br/**`.
- Mantenha `http://localhost:3000/auth/callback` para desenvolvimento.

### 5. Checklist pós-deploy

- [ ] Migrações `0003`, `0005`, `0006`, `0007` aplicadas no SQL Editor.
- [ ] Provider de e-mail (Magic Link) habilitado; phone provider para OTP.
- [ ] `https://SEU-DOMINIO/b/demo` abre o agendamento.
- [ ] `/auth/signup-barbershop` cria a org e leva ao `/app/admin/dashboard`.
- [ ] Login por papel redireciona corretamente (owner/barber/client).
- [ ] `GET https://SEU-DOMINIO/app/admin/dashboard` sem sessão → `/auth/login`.

