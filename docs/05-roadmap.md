# SaaS V2 — Roadmap de Implementação (MVP em 5 sprints)

> Premissas: equipe enxuta (1 full-stack + 1 designer part-time, ou 1 dev solo com templates). Sprints de 2 semanas. Cadência: deploy contínuo em preview por PR. Meta: **pagar o primeiro PIX real na Sprint 4**.

---

## Sprint 0 — Fundação (semana 0, pré-MVP)
**Objetivo:** esqueleto de produto destravando tudo o resto.

- [ ] Supabase: projeto, migração `0001_initial_schema.sql` aplicada, seeds (org demo, 4 serviços, 2 profissionais)
- [ ] Next.js 14 + Tailwind + shadcn/ui + design tokens do `03-design-system.md` (dark/light)
- [ ] Auth: OTP por telefone (cliente) + e-mail/senha (staff), middleware de roles
- [ ] CI: lint, type-check, deploy preview (Vercel), supabase CLI em staging
- [ ] Sentry + PostHog instrumentados

**Saída:** login OTP funcionando em staging, schema com RLS validado por testes de isolamento de tenant.

---

## Sprint 1 — Agendamento público (o funil)
**Objetivo:** qualquer pessoa agendar em ≤3 toques, sem conta.

- [ ] Edge: `GET /org`, `GET /slots` (cache 30s, duração real, time_off, ocupação)
- [ ] Tela 1 Catálogo + Tela 2 Data/Horário (mobile-first, skeletons)
- [ ] Tela 3 Confirmação + OTP inline + criação de `customer`
- [ ] `POST /appointments` com tratamento de 409 (sugere próximos slots)
- [ ] "Minha Reserva" via link mágico: ver / reagendar / cancelar
- [ ] Página pública `/b/{slug}` com branding da org
- [ ] Testes E2E do funil (Playwright) — incluindo corrida de duplo agendamento

**Saída:** funil público completo no ar em staging; teste de carga de 50 agendamentos simultâneos no mesmo slot → 1 vence, 49 recebem alternativas.

## Sprint 2 — App do barbeiro
**Objetivo:** a cadeira roda o dia inteiro pelo celular.

- [ ] Tela "Hoje": timeline por horário, status em 1 toque (chegou → em andamento → concluído/falta)
- [ ] Walk-in: encaixe rápido pré-preenchido pelo slot vazio
- [ ] Comanda: itens (serviços/produtos/gorjeta), checkout PIX (Mercado Pago sandbox) + cash
- [ ] Trigger `fn_on_payment` validado de ponta a ponta → comissões + LTV atualizados
- [ ] Bloqueios pessoais de agenda (time_off) + visualização semanal
- [ ] "Meu Dinheiro": extrato de comissões em tempo real (RLS self-service)
- [ ] PWA instalável + notificação push local ("Marina chegou")

**Saída:** barbeiro consegue atender, cobrar via PIX e ver a comissão cair — com sandbox.

## Sprint 3 — Painel do gestor
**Objetivo:** o dono abre o app e entende o negócio em 5 segundos.

- [ ] Dashboard: KPIs (líquido, ocupação, ticket, no-show) + série diária + comparação de período
- [ ] Agenda visual (grade dia × cadeiras) com drag-and-drop (reagendar + auditoria)
- [ ] CRUD: serviços, profissionais (com regra de comissão fixa), produtos, expediente/feriados
- [ ] Despesas + visão bruto → taxas → comissões → despesas → líquido
- [ ] Relatório de comissões por período + CSV + "marcar como pago"
- [ ] CRM básico: lista de clientes com LTV, inatividade e ação "resgatar" com template

**Saída:** gestão completa de 1 barbearia real (piloto).

## Sprint 4 — Produção + WhatsApp transacional
**Objetivo:** lançar com clientes reais.

- [ ] Evolution API em produção: `appt_confirm`, `reminder_24h`, `reminder_2h`, cancelamento/reagendamento
- [ ] Worker de lembretes (`pg_cron` + `SKIP LOCKED`), quiet hours, log de entrega + webhook de status
- [ ] Gateway em produção (conta real): PIX dinâmico, polling, recibo via WhatsApp
- [ ] Política de cancelamento/no-show + aviso nos lembretes
- [ ] Onboarding do primeiro piloto: importação de clientes (planilha telefone+nome → customers)
- [ ] Runbook: deploy, rollback, restore, custos (Supabase/Evolution/MP)

**Saída:** 🚀 **MVP no ar cobrando**. Meta de adoção: 1 barbearia, 50 agendamentos/semana, lembrete entregue em ≥90%.

---

## Pós-MVP (Sprints 5+) — Recorrência e retenção
| Sprint | Entrega |
|---|---|
| 5 | **Clube do Corte**: planos, assinatura Asaas, `credit_ledger`, agendamento com créditos, badge de membro |
| 6 | Fidelidade: pontos automáticos, resgate, indicação com cupom; avaliações NPS pós-atendimento |
| 7 | BI avançado: heatmap de ocupação, coortes/LTV projetado, sugestão de horários ociosos |
| 8 | Comissão progressiva por faixa + override por profissional×serviço; fechamento assinado digitalmente |
| 9 | Multi-unidade e rede (franquia), relatórios consolidados |
| 10 | Meta Cloud API oficial + campanhas por segmento; app cliente com push nativo |

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| WhatsApp não-oficial (Evolution) ser bloqueado | Abstração de transporte já na Sprint 4; migração p/ Meta API pronta |
| Frio do piloto (barbeiro não usa) | App do barbeiro mobile-first sem login permanente (PIN de 4 dígitos por cadeira) |
| Double-booking | Constraint no Postgres (não lógica de app) + E2E de corrida |
| Escopo inflar no MVP | Pós-MVP travado: clube, pontos e BI avançado SÓ após 3 barbearias pagantes |

## Definição de pronto (todos os sprints)
1. Testes de isolamento RLS (novo cliente não lê dados de outro org) verdes.
2. Zero `alert()`/`confirm()` — só Toast/Sheet do design system.
3. Lighthouse ≥ 90 (mobile) nas telas do cliente.
4. Todo dado sensível via env/secrets — scan de secrets no CI.
