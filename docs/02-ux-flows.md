# SaaS V2 — Arquitetura de Telas & Fluxos de UX Premium

> Regra de ouro: **o cliente nunca cria senha**; o barbeiro nunca digita nada que o sistema já sabe; o dono nunca precisa "puxar relatório".

---

## 1. FLUXO DO CLIENTE — Zero Friction (≤3 toques)

### Entry points
| Origem | Link | Pré-preenchido |
|---|---|---|
| Bio do Instagram | `app.com/b/{slug}` | — |
| Link mágico WhatsApp | `app.com/b/{slug}?svc={id}&pro={id}` | serviço + profissional |
| Lembrete/lembrete de reagenda | `app.com/a/{reschedule_token}` | agendamento existente |

### Tela 1 — Catálogo (toque 0)
```
┌────────────────────────────────────┐
│  [Logo]  Nome da Barbearia    🌙  │  ← dark default, toggle persistido
│  Seg–Sáb · 09h–20h                 │
│────────────────────────────────────│
│  SERVIÇOS                          │
│  ┌──────────────┐ ┌──────────────┐ │
│  │ Corte Simples│ │ Corte+Barba  │ │  ← chips horizontais, foto+preço
│  │ R$ 40 · 30min│ │ R$ 60 · 45min│ │    (svc pré-selecionado se ?svc)
│  └──────────────┘ └──────────────┘ │
│  PROFISSIONAIS                     │
│  (avatars) ⭕ Qualquer  José  Mike │  ← "Qualquer" = primeiro livre
│                                    │
│  [ Continuar ]                     │  ← sticky bottom, disabled até svc
└────────────────────────────────────┘
```
- Sem header de login. Sem cadastro. O primeiro contato com o sistema é **escolher**.
- "Qualquer profissional" resolve no backend o primeiro slot livre entre todos.

### Tela 2 — Data & Horário (toque 1)
```
┌────────────────────────────────────┐
│ ← Corte Simples · José             │
│ ┌──────────────────────────────┐   │
│ │ SEG  TER  QUA  QUI  SEX  SÁB│   │  ← carousel 14 dias, dots p/ mais
│ │ 20   21   22   23   24   25  │   │    (badges: "lotado", "férias")
│ └──────────────────────────────┘   │
│  MANHÃ                             │
│  ┌────┬────┬────┐  TARDE          │
│  │09:00│09:30│10:00│  ┌────┬────┐ │  ← slots reais da API (duração
│  └────┴────┴────┘  │14:00│14:30│ │    do serviço respeitada)
│                    └────┴────┴─── │
│────────────────────────────────────│
│  [ Confirmar 10:30 ]               │  ← sticky
└────────────────────────────────────┘
```
- `GET /slots` já retorna apenas horários viáveis (expediente − almoço − bloqueios − ocupação − duração). O cliente nunca vê um horário que não existe.
- Animação: pill dourada desliza entre slots (layout animation).

### Tela 3 — Confirmação (toque 2)
```
┌────────────────────────────────────┐
│  ✂️ Corte Simples · R$ 40          │
│  ✂️ José · Qua 22/10 · 10:30       │
│                                    │
│  Seu WhatsApp:                     │
│  ┌──────────────────────────────┐  │
│  │ +55 (11) 9••••-••••  ✏️     │  │  ← reconhecido por device → pula
│  └──────────────────────────────┘  │    este passo inteiro
│  ┌──────────────────────────────┐  │
│  │      Confirmar agendamento   │  │
│  └──────────────────────────────┘  │
│  Ao pagar no local · Cancelamento  │
│  grátis até 4h antes               │
└────────────────────────────────────┘
```
**Lógica de identificação sem senha:**
1. Device tem `supabase.auth` session (OTP anterior) → tela vira resumo + botão "Confirmar" (toque 3 e acabou).
2. Novo device → usuário digita telefone → `POST /auth/otp/request` → tela de código (4 dígitos, auto-submit) → session criada → **customer row criada/upsert por phone** (`org_id + phone`).
3. Confirmação → sheet sobe com spring + checkmark animado + opção "Adicionar ao WhatsApp" (deep link `wa.me` com texto do agendamento — substitui o `window.open` forçado do V1).

### Tela 4 — "Minha Reserva" (pós-agendamento, via push/WhatsApp)
- Link mágico `/a/{token}` → resumo + 2 botões grandes: **Reagendar** / **Cancelar**.
- Reagendar abre a Tela 2 com o agendamento atual pré-carregado — sem login, sem digitar nada.
- Cancelamento com política: dentro de 4h da agenda → aviso de no-show fee (config da org).

### Retenção (loops embutidos)
- Lembretes T-24h e T-2h via WhatsApp (fila `reminder_queue`).
- T+2h após `completed` → pedido de avaliação 1–5 (NPS).
- Inativo 21 dias → campanha automática de resgate com cupom.
- Fim de mês → resumo "Você cortou 4x este mês 💈" + upsell do Clube.

---

## 2. PAINEL DO BARBEIRO (mobile-first, PWA)

### 2.1 Hoje (tela default — abre direto)
```
┌────────────────────────────────────┐
│  Oi, José           ☀️ Qua 22/10   │
│  ┌──────────────────────────────┐  │
│  │ HOJE  6 atendimentos · R$290│  │  ← faixa de resumo
│  └──────────────────────────────┘  │
│  09:00  ⬤ Carlos                   │
│         Corte Simples · R$40       │  ← cards por horário
│         [Chegou]                   │  ← 1 toque → checked_in
│  09:30  ⬤ 🔓 Livre                 │
│         [+ Encaixe walk-in]        │  ← 1 toque abre comanda
│  10:00  ⬤ Marina    [Em andamento] │
│         Corte+Barba · R$60         │
│         [Cobrar]  ←─────────────┐  │
│  ...                             │  │
│──────────────────────────────────┴──│
│  📅 Hoje │ 🧾 Comanda │ 💰 Meu $ │  │  ← 3 itens, nunca mais
└────────────────────────────────────┘
```
- Máximo de 1 scroll para ver o dia todo. Sem filtros, sem período — é o HOJE.
- Atalho de teclado (desktop): `C` conclui, `F` falta, `E` encaixe.
- Swipe para o lado no card = ações rápidas (mobile).

### 2.2 Comanda (fechamento em ≤4 toques)
```
┌────────────────────────────────────┐
│  Marina · 10:00 · Corte+Barba      │
│  ┌──────────────────────────────┐  │
│  │ ✂ Corte+Barba      R$ 60,00  │  │  ← serviço já vem da reserva
│  │ + Adicionar item             │  │  ← sheet: serviços / produtos /
│  │ 🎁 Gorjeta                   │  │      créditos do clube
│  │ ─────────────────────────    │  │
│  │ TOTAL               R$ 75,00 │  │
│  └──────────────────────────────┘  │
│  [PIX] [Cartão] [Dinheiro]         │  ← PIX abre QR gerado pelo gateway
│  [ Fechar comanda ]                │
└────────────────────────────────────┘
```
- Ao marcar `completed` no atendimento, a comanda abre **pré-populada**. Nunca digitar preço.
- PIX: gera QR real (Mercado Pago/Asaas) + **polling/WS** confirma pagamento e dispara comissão automaticamente.

### 2.3 Meu Dinheiro (extrato em tempo real)
```
┌────────────────────────────────────┐
│  A RECEBER (outubro)               │
│  R$ 1.284,50                       │  ← count-up animation
│  Serviços R$1.140 · Gorjetas R$144 │
│────────────────────────────────────│
│  Pago    ● PIX 20/10  ───── R$ 320│
│  Pend.   ○ Fechamento 31/10        │  ← dono "paga o período"
│  Pend.   ○ PIX avulso  R$  60     │
│────────────────────────────────────│
│  [ Copiar chave PIX ]              │
└────────────────────────────────────┘
```
- Barbeiro vê **apenas as próprias comissões** (RLS), nunca as dos outros.

---

## 3. DASHBOARD DO GESTOR (web, desktop-first)

### Layout
```
┌──────────┬───────────────────────────────────────────────────┐
│ LOGO     │  Hoje · [7d] [30d] [Personalizado] · Prof: [Todos]│
│          │───────────────────────────────────────────────────│
│ 📊 Visão │  ┌─────────┐ ┌─────────┐ ┌────────┐ ┌──────────┐  │
│ 📅 Agenda│  │ LÍQUIDO │ │ OCUPAÇÃO│ │ TICKET │ │ NO-SHOW  │  │
│ 👥 Equipe│  │ R$8.412 │ │   74%   │ │ R$ 52  │ │   4,1%   │  │
│ ✂ Serviços│  └─────────┘ └─────────┘ └────────┘ └──────────┘  │
│ 💰 Finance│───────────────────────────────────────────────────│
│ 📣 CRM   │  ┌───────────────────────┐ ┌─────────────────────┐ │
│ ⚙ Config │  │ Evolução (líq vs bruto)│ │ Ocupação por cadeira│ │
│          │  │     📈 area chart      │ │  heatmap 7×horas    │ │
│          │  └───────────────────────┘ └─────────────────────┘ │
│          │───────────────────────────────────────────────────│
│          │  Top clientes (LTV)  │  Comissões a pagar  [Pagar] │
└──────────┴───────────────────────────────────────────────────┘
```

### Métricas — definições honestas (sem números mágicos)
| Card | Fórmula (backend) |
|---|---|
| **Líquido** | `Σ transactions.net` (bruto − taxas reais do gateway) |
| **Ocupação** | `Σ duration_min atendidos ÷ (cadeiras × minutos de expediente)` no período |
| **Ticket médio** | `Σ net ÷ count(atendimentos concluídos)` |
| **No-show %** | `count(no_show) ÷ total de agendamentos do período` |
| **LTV** | `Σ customers.total_spent` por coorte + projeção 12m (curva de recompra) |
| **Retenção 90d** | `% de clientes com ≥1 visita nos últimos 90 dias` (view materializada) |

### Telas secundárias
- **Agenda (visual):** grade dia × cadeiras com drag-and-drop entre slots (move = reagendar + evento de auditoria + notificação). Modo "Monitor" para TV da recepção.
- **Equipe:** CRUD de profissionais, regra de comissão (fixa ou progressiva por faixa), status de pagamento do período com assinatura digital.
- **Financeiro:** bruto → taxas → comissões → despesas → **lucro**; export CSV/OFX; fechamento mensal travado (não edita histórico).
- **CRM:** segmentos automáticos ("Clube", "Inativo 30d", "VIP LTV>R$500", "No-show 2x") + disparo WhatsApp com template aprovado.
- **Config:** expediente por dia da semana (grade), almoço, feriados, política de cancelamento, lembretes, branding.

---

## 4. ESTADOS E DETALHES TRANSVERSAIS

| Estado | Tratamento |
|---|---|
| Loading | Skeleton idêntico ao layout final (nunca spinner central) |
| Erro | Toast + retry inline; nunca `alert()` |
| Confirmação destrutiva | Sheet com desfazer (5s), não `confirm()` |
| Offline (barbeiro) | Fila local IndexedDB, sincroniza sozinho |
| Vazio | Ilustração + 1 CTA ("Sua agenda está livre hoje ☕") |
| Conflito de slot | Revalida no backend; se ocupou, sugere os 3 próximos livres com animação |
