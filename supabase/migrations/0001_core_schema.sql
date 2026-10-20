-- ============================================================================
--  SaaS V2 PREMIUM — SCHEMA DEFINITIVO (Supabase / PostgreSQL 15+)
--  Barbearia SaaS multi-tenant
--
--  PRINCÍPIOS:
--   • org_id em TODA tabela operacional  → multi-tenancy + RLS
--   • FKs reais (nunca nomes em texto)   → renomear não quebra histórico
--   • snapshots imutáveis (preço, taxa)  → faturamento/comissão históricos corretos
--   • timestamptz / NUMERIC / ENUM       → nada de VARCHAR para data, status ou dinheiro
--   • double-booking impossível no banco  → EXCLUDE constraint (não confie no frontend)
--
--  Executar via: supabase db push   |   psql $DATABASE_URL -f 0001_initial_schema.sql
-- ============================================================================

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. EXTENSÕES E TIPOS ENUM
-- ═════════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "btree_gist"; -- EXCLUDE com = em colunas FK

create type public.app_role            as enum ('owner', 'barber', 'receptionist', 'client');
create type public.appointment_status  as enum
  ('pending', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show');
create type public.appointment_source  as enum ('client', 'staff', 'walk_in', 'whatsapp');
create type public.order_status        as enum ('open', 'paying', 'paid', 'voided');
create type public.order_item_kind     as enum ('service', 'product', 'plan_credit');
create type public.payment_method      as enum ('pix', 'credit', 'debit', 'cash', 'online');
create type public.transaction_status  as enum ('pending', 'paid', 'refunded', 'failed');
create type public.commission_status   as enum ('pending', 'paid');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled');
create type public.credit_kind         as enum ('purchase', 'consumed', 'expired', 'bonus', 'referral');
create type public.event_type          as enum
  ('created', 'confirmed', 'reminder_sent', 'rescheduled', 'status_changed',
   'cancelled', 'checked_in', 'completed', 'note');
create type public.notify_channel      as enum ('whatsapp', 'sms', 'email');
create type public.notify_status       as enum ('queued', 'sent', 'delivered', 'failed');
create type public.expense_category    as enum
  ('rent', 'payroll', 'supplies', 'utilities', 'marketing', 'equipment', 'tax', 'other');

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. TENANT (BARBEARIA)
-- ═════════════════════════════════════════════════════════════════════════════

create table public.organizations (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    slug        text not null unique,               -- URL pública: app.com/b/{slug}
    phone       text,
    address     jsonb,
    timezone    text not null default 'America/Sao_Paulo',
    logo_url    text,
    brand jsonb not null default '{}',              -- config de UI (cores, etc.)
    settings jsonb not null default                 -- regras operacionais da casa
        '{"slot_interval_min": 30,
          "cancellation_policy_hours": 4,
          "noshow_fee_pct": 0,
          "reminder_hours": [24, 2]}',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. USUÁRIOS (auth.users do Supabase + perfil operacional)
-- ═════════════════════════════════════════════════════════════════════════════

create table public.profiles (
    id          uuid primary key references auth.users (id) on delete cascade,
    org_id      uuid references public.organizations (id) on delete cascade,
    role        public.app_role not null default 'client',
    full_name   text not null,
    phone       text,                                -- E.164: +5511999999999
    email       text,
    pix_key     text,                                -- barbeiro: chave de repasse
    avatar_url  text,
    active      boolean not null default true,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    constraint phone_e164 check (phone is null or phone ~ '^\+[1-9]\d{10,14}$')
);

create index idx_profiles_org   on public.profiles (org_id) where role <> 'client';
create index idx_profiles_phone on public.profiles (phone);

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. PROFSSIONAIS (cadeira) — separado de profiles: profissional pode existir
--    sem login, e um login cobre várias cadeiras em redes.
-- ═════════════════════════════════════════════════════════════════════════════

create table public.professionals (
    id          uuid primary key default gen_random_uuid(),
    org_id      uuid not null references public.organizations (id) on delete cascade,
    user_id     uuid references public.profiles (id) on delete set null,
    full_name   text not null,
    phone       text,
    pix_key     text,
    color       text,                                 -- cor da cadeira na agenda
    active      boolean not null default true,
    sort_order  int not null default 0,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index idx_professionals_org on public.professionals (org_id) where active;

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. SERVIÇOS — duração É DADO (nunca texto), comissão padrão da casa aqui
-- ═════════════════════════════════════════════════════════════════════════════

create table public.services (
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid not null references public.organizations (id) on delete cascade,
    name            text not null,
    description     text,
    duration_min    int  not null check (duration_min between 5 and 480),
    price           numeric(12,2) not null check (price >= 0),
    cost            numeric(12,2) not null default 0 check (cost >= 0),
    commission_pct  numeric(5,2) not null default 40 check (commission_pct between 0 and 100),
    active          boolean not null default true,
    sort_order      int not null default 0,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index idx_services_org on public.services (org_id) where active;

-- Override por profissional: preço/duração/comissão diferentes por cadeira
create table public.professional_services (
    professional_id       uuid not null references public.professionals (id) on delete cascade,
    service_id            uuid not null references public.services (id) on delete cascade,
    price_override        numeric(12,2) check (price_override >= 0),
    duration_override_min int check (duration_override_min between 5 and 480),
    commission_pct_override numeric(5,2) check (commission_pct_override between 0 and 100),
    active                boolean not null default true,
    primary key (professional_id, service_id)
);

-- ═════════════════════════════════════════════════════════════════════════════
-- 6. PRODUTOS (venda leve na comanda)
-- ═════════════════════════════════════════════════════════════════════════════

create table public.products (
    id          uuid primary key default gen_random_uuid(),
    org_id      uuid not null references public.organizations (id) on delete cascade,
    name        text not null,
    price       numeric(12,2) not null check (price >= 0),
    cost        numeric(12,2) not null default 0,
    stock_qty   int,
    track_stock boolean not null default false,
    active      boolean not null default true,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index idx_products_org on public.products (org_id) where active;

-- ═════════════════════════════════════════════════════════════════════════════
-- 7. CLIENTES — identidade por telefone (OTP), cache de LTV via trigger
-- ═════════════════════════════════════════════════════════════════════════════

create table public.customers (
    id             uuid primary key default gen_random_uuid(),
    org_id         uuid not null references public.organizations (id) on delete cascade,
    user_id        uuid references public.profiles (id) on delete set null, -- null = guest OTP
    full_name      text not null,
    phone          text not null,
    email          text,
    birth_date     date,
    notes          text,                              -- "alergia a navalha", "prefere máquina 2"
    allows_marketing boolean not null default true,
    -- métricas cacheadas — mantidas por trigger (fonte de verdade = transações)
    total_spent    numeric(12,2) not null default 0,
    visits_count   int not null default 0,
    no_show_count  int not null default 0,
    first_visit_at timestamptz,
    last_visit_at  timestamptz,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    unique (org_id, phone),
    constraint phone_e164 check (phone ~ '^\+[1-9]\d{10,14}$')
);

create index idx_customers_org  on public.customers (org_id);
create index idx_customers_user on public.customers (user_id);
create index idx_customers_ltv  on public.customers (org_id, total_spent desc);

-- ═════════════════════════════════════════════════════════════════════════════
-- 8. DISPONIBILIDADE — expediente da casa e bloqueios individuais
-- ═════════════════════════════════════════════════════════════════════════════

create table public.availability_rules (
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid not null references public.organizations (id) on delete cascade,
    professional_id uuid references public.professionals (id) on delete cascade, -- null = casa toda
    weekday         int not null check (weekday between 0 and 6),  -- 0 = domingo
    start_time      time not null,
    end_time        time not null,
    valid_from      date,
    valid_to        date,
    constraint time_order check (start_time < end_time)
);

create index idx_availability_org on public.availability_rules (org_id, professional_id, weekday);

create table public.time_off (                          -- férias, folga, almoço, feriado
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid not null references public.organizations (id) on delete cascade,
    professional_id uuid references public.professionals (id) on delete cascade, -- null = casa toda
    starts_at       timestamptz not null,
    ends_at         timestamptz not null,
    all_day         boolean not null default false,
    reason          text,
    created_by      uuid references public.profiles (id),
    created_at      timestamptz not null default now(),
    constraint time_order check (starts_at < ends_at)
);

create index idx_time_off_org on public.time_off (org_id, starts_at, ends_at);

-- ═════════════════════════════════════════════════════════════════════════════
-- 9. AGENDAMENTOS
--     • snapshot de nome/preço/duração → mudar catálogo nunca reescreve histórico
--     • EXCLUDE (professional_id WITH =, range WITH &&) → banco impede duplo agendamento
-- ═════════════════════════════════════════════════════════════════════════════

create table public.appointments (
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid not null references public.organizations (id) on delete cascade,
    customer_id     uuid not null references public.customers (id) on delete restrict,
    professional_id uuid not null references public.professionals (id) on delete restrict,
    service_id      uuid not null references public.services (id) on delete restrict,
    -- ── snapshots imutáveis ──
    service_name        text not null,
    service_price       numeric(12,2) not null,
    service_commission_pct numeric(5,2) not null,
    duration_min        int not null,
    -- ── estado ──
    start_at        timestamptz not null,
    end_at          timestamptz not null,
    status          public.appointment_status not null default 'confirmed',
    source          public.appointment_source not null default 'client',
    cancel_reason   text,
    reschedule_token uuid not null unique default gen_random_uuid(), -- link mágico sem login
    created_by      uuid references public.profiles (id),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    constraint valid_range check (start_at < end_at),
    constraint future_or_today check (start_at > now() - interval '1 day')
        -- agendamentos do passado só via walk-in backfill; validado em app para casos comuns
);

-- Anti double-booking: NUNCA dois atendimentos ativos do mesmo profissional sobrepõem.
-- Status 'cancelled'/'no_show' liberam a cadeira (partial constraint index).
alter table public.appointments
    add constraint excl_double_booking
    exclude using gist (professional_id with =, tstzrange(start_at, end_at) with &&)
    where (status in ('pending', 'confirmed', 'checked_in', 'in_progress'));

create index idx_appt_org_time     on public.appointments (org_id, start_at desc);
create index idx_appt_prof_time    on public.appointments (professional_id, start_at);
create index idx_appt_customer     on public.appointments (customer_id, start_at desc);
create index idx_appt_status_today on public.appointments (org_id, status, start_at)
    where status in ('confirmed', 'checked_in', 'in_progress');
create index idx_appt_token        on public.appointments (reschedule_token);

-- Trilha de auditoria: TODO evento relevante vira linha. Só INSERT/UPDATE.
create table public.appointment_events (
    id             bigserial primary key,
    appointment_id uuid not null references public.appointments (id) on delete cascade,
    actor_id       uuid references public.profiles (id),
    type           public.event_type not null,
    payload        jsonb not null default '{}',
    created_at     timestamptz not null default now()
);

create index idx_appt_events on public.appointment_events (appointment_id, created_at);

-- ═════════════════════════════════════════════════════════════════════════════
-- 10. COMANDA, ITENS, TRANSAÇÕES E COMISSÕES
-- ═════════════════════════════════════════════════════════════════════════════

create table public.orders (
    id             uuid primary key default gen_random_uuid(),
    org_id         uuid not null references public.organizations (id) on delete cascade,
    appointment_id uuid unique references public.appointments (id) on delete set null,
    customer_id    uuid not null references public.customers (id) on delete restrict,
    status         public.order_status not null default 'open',
    subtotal       numeric(12,2) not null default 0,
    discount       numeric(12,2) not null default 0 check (discount >= 0),
    tip            numeric(12,2) not null default 0 check (tip >= 0),
    total          numeric(12,2) not null default 0,
    opened_at      timestamptz not null default now(),
    closed_at      timestamptz,
    created_by     uuid references public.profiles (id),
    updated_at     timestamptz not null default now()
);

create index idx_orders_org    on public.orders (org_id, status);
create index idx_orders_customer on public.orders (customer_id);

-- Item com PREÇO CONGELADO no momento da cobrança
create table public.order_items (
    id          uuid primary key default gen_random_uuid(),
    order_id    uuid not null references public.orders (id) on delete cascade,
    kind        public.order_item_kind not null,
    ref_id      uuid,                                  -- services.id ou products.id (informativo)
    name        text not null,                         -- snapshot do nome
    qty         int not null default 1 check (qty > 0),
    unit_price  numeric(12,2) not null,
    total       numeric(12,2) generated always as (qty * unit_price) stored,
    added_by    uuid references public.profiles (id),
    created_at  timestamptz not null default now()
);

create index idx_order_items on public.order_items (order_id);

create table public.transactions (
    id          uuid primary key default gen_random_uuid(),
    org_id      uuid not null references public.organizations (id) on delete cascade,
    order_id    uuid not null references public.orders (id) on delete restrict,
    method      public.payment_method not null,
    gross       numeric(12,2) not null check (gross >= 0),
    fee         numeric(12,2) not null default 0,        -- taxa REAL devolvida pelo gateway
    net         numeric(12,2) generated always as (gross - fee) stored,
    status      public.transaction_status not null default 'pending',
    gateway     text,                                   -- 'mercadopago' | 'asaas' | 'manual'
    gateway_id  text unique,                            -- idempotência do webhook
    qr_code     text,                                   -- copia-e-cola PIX (gerado no checkout)
    paid_at     timestamptz,
    created_at  timestamptz not null default now()
);

create index idx_tx_org_time on public.transactions (org_id, paid_at desc) where status = 'paid';

-- Repasse: taxa e valor CONGELADOS quando a transação é paga
create table public.commissions (
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid not null references public.organizations (id) on delete cascade,
    professional_id uuid not null references public.professionals (id) on delete restrict,
    transaction_id  uuid not null references public.transactions (id) on delete cascade,
    appointment_id  uuid references public.appointments (id) on delete set null,
    rate            numeric(5,4) not null,               -- 0.4000
    base            numeric(12,2) not null,              -- bruto do serviço
    amount          numeric(12,2) not null,              -- base * rate
    tip_amount      numeric(12,2) not null default 0,    -- gorjeta 100% ao profissional
    period          date not null,                       -- DATE(paid_at) → fechamento mensal
    status          public.commission_status not null default 'pending',
    paid_at         timestamptz,
    created_at      timestamptz not null default now()
);

create index idx_commissions_period on public.commissions (org_id, period, status);
create index idx_commissions_prof   on public.commissions (professional_id, status);

create table public.expenses (
    id          uuid primary key default gen_random_uuid(),
    org_id      uuid not null references public.organizations (id) on delete cascade,
    description text not null,
    category    public.expense_category not null default 'other',
    amount      numeric(12,2) not null check (amount > 0),
    paid_at     date not null,
    receipt_url text,
    created_by  uuid references public.profiles (id),
    created_at  timestamptz not null default now()
);

create index idx_expenses_org on public.expenses (org_id, paid_at desc);

-- ═════════════════════════════════════════════════════════════════════════════
-- 11. PLANOS, ASSINATURAS E CRÉDITOS (Clube do Corte)
-- ═════════════════════════════════════════════════════════════════════════════

create table public.plans (
    id                  uuid primary key default gen_random_uuid(),
    org_id              uuid not null references public.organizations (id) on delete cascade,
    name                text not null,                  -- 'Clube Ouro'
    description         text,
    price_monthly       numeric(12,2) not null check (price_monthly >= 0),
    credits_per_month   int not null default 0 check (credits_per_month >= 0),
    credit_service_ids  uuid[] not null default '{}',   -- serviços incluídos no crédito
    bonus_perks         jsonb not null default '{}',    -- {"priority_slots": true, "discount_pct": 10}
    active              boolean not null default true,
    created_at          timestamptz not null default now()
);

create table public.subscriptions (
    id                  uuid primary key default gen_random_uuid(),
    org_id              uuid not null references public.organizations (id) on delete cascade,
    customer_id         uuid not null references public.customers (id) on delete cascade,
    plan_id             uuid not null references public.plans (id) on delete restrict,
    status              public.subscription_status not null default 'trialing',
    gateway             text,
    gateway_sub_id      text unique,
    current_period_start date not null,
    current_period_end   date not null,
    cancel_at_period_end boolean not null default true,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create unique index idx_sub_active_customer on public.subscriptions (customer_id)
    where status in ('trialing', 'active', 'past_due');

-- Ledger duplo-entry: delta negativo consome, positivo credita. Nunca UPDATE — só INSERT.
create table public.credit_ledger (
    id          bigserial primary key,
    org_id      uuid not null references public.organizations (id) on delete cascade,
    customer_id uuid not null references public.customers (id) on delete cascade,
    delta       int not null,
    kind        public.credit_kind not null,
    ref_id      uuid,
    expires_at  date,
    created_at  timestamptz not null default now()
);

create index idx_credits_balance on public.credit_ledger (customer_id, kind);

create or replace function public.customer_credit_balance(p_customer uuid)
returns int language sql stable as $$
    select coalesce(sum(delta), 0)::int
    from public.credit_ledger
    where customer_id = p_customer
      and (expires_at is null or expires_at >= current_date)
$$;

create table public.loyalty_points (
    id          bigserial primary key,
    org_id      uuid not null references public.organizations (id) on delete cascade,
    customer_id uuid not null references public.customers (id) on delete cascade,
    delta       int not null,
    reason      text,
    ref_id      uuid,
    created_at  timestamptz not null default now()
);

create index idx_points_balance on public.loyalty_points (customer_id);

create or replace function public.customer_points_balance(p_customer uuid)
returns int language sql stable as $$
    select coalesce(sum(delta), 0)::int from public.loyalty_points where customer_id = p_customer
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 12. NOTIFICAÇÕES (log de auditoria do motor de mensagens)
-- ═════════════════════════════════════════════════════════════════════════════

create table public.notifications (
    id           uuid primary key default gen_random_uuid(),
    org_id       uuid not null references public.organizations (id) on delete cascade,
    customer_id  uuid references public.customers (id) on delete set null,
    professional_id uuid references public.professionals (id) on delete set null,
    channel      public.notify_channel not null default 'whatsapp',
    template     text not null,                        -- 'appt_confirm','appt_reminder_24h',...
    payload      jsonb not null default '{}',
    status       public.notify_status not null default 'queued',
    error        text,
    sent_at      timestamptz,
    created_at   timestamptz not null default now()
);

create index idx_notifications_due on public.notifications (status, created_at)
    where status = 'queued';

-- Fila de lembretes agendados (por pg_cron ou worker)
create table public.reminder_queue (
    id             bigserial primary key,
    appointment_id uuid not null references public.appointments (id) on delete cascade,
    template       text not null,                      -- 'reminder_24h','reminder_2h'
    send_at        timestamptz not null,
    sent_at        timestamptz,
    unique (appointment_id, template)
);

create index idx_reminder_due on public.reminder_queue (send_at) where sent_at is null;

-- ═════════════════════════════════════════════════════════════════════════════
-- 13. FUNÇÕES UTILITÁRIAS + TRIGGERS
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end $$;

create trigger t_org_updated     before update on public.organizations   for each row execute function public.set_updated_at();
create trigger t_prof_updated    before update on public.profiles        for each row execute function public.set_updated_at();
create trigger t_prof2_updated   before update on public.professionals   for each row execute function public.set_updated_at();
create trigger t_serv_updated    before update on public.services        for each row execute function public.set_updated_at();
create trigger t_prod_updated    before update on public.products        for each row execute function public.set_updated_at();
create trigger t_cust_updated    before update on public.customers       for each row execute function public.set_updated_at();
create trigger t_appt_updated    before update on public.appointments    for each row execute function public.set_updated_at();
create trigger t_order_updated   before update on public.orders          for each row execute function public.set_updated_at();
create trigger t_sub_updated     before update on public.subscriptions   for each row execute function public.set_updated_at();

-- ── Agendamento: snapshot automático + end_at pela duração ──────────────────
create or replace function public.fn_appt_snapshot()
returns trigger language plpgsql as $$
declare
    v_price numeric(12,2);
    v_dur   int;
    v_comm  numeric(5,2);
begin
    select coalesce(ps.price_override, s.price),
           coalesce(ps.duration_override_min, s.duration_min),
           coalesce(ps.commission_pct_override, s.commission_pct)
    into v_price, v_dur, v_comm
    from public.services s
    left join public.professional_services ps
      on ps.service_id = s.id and ps.professional_id = new.professional_id
    where s.id = new.service_id;

    if v_price is null then
        raise exception 'Serviço % inexistente ou inativo', new.service_id;
    end if;

    new.service_name           := (select name from public.services where id = new.service_id);
    new.service_price          := v_price;
    new.duration_min           := v_dur;
    new.service_commission_pct := v_comm;
    new.end_at                 := new.start_at + make_interval(mins => v_dur);

    -- lembretes T-24h e T-2h (horários do settings da org ficam para a API decidir)
    insert into public.reminder_queue (appointment_id, template, send_at)
    values (new.id, 'reminder_24h', new.start_at - interval '24 hours'),
           (new.id, 'reminder_2h',  new.start_at - interval '2 hours')
    on conflict do nothing;

    return new;
end $$;

create trigger t_appt_snapshot
    before insert on public.appointments
    for each row execute function public.fn_appt_snapshot();

-- ── Auditoria de eventos do agendamento ─────────────────────────────────────
create or replace function public.fn_appt_audit()
returns trigger language plpgsql as $$
begin
    if tg_op = 'INSERT' then
        insert into public.appointment_events (appointment_id, type, payload)
        values (new.id, 'created',
                jsonb_build_object('status', new.status, 'source', new.source,
                                   'start_at', new.start_at));
    elsif new.status is distinct from old.status then
        insert into public.appointment_events (appointment_id, type, payload)
        values (new.id, case when new.status = 'cancelled' then 'cancelled'::public.event_type
                             when new.status = 'completed' then 'completed'::public.event_type
                             when new.status = 'checked_in' then 'checked_in'::public.event_type
                             else 'status_changed' end,
                jsonb_build_object('from', old.status, 'to', new.status));

        if new.status = 'no_show' then
            update public.customers set no_show_count = no_show_count + 1
            where id = new.customer_id;
        end if;
    end if;

    if tg_op = 'UPDATE'
       and (new.start_at is distinct from old.start_at
            or new.professional_id is distinct from old.professional_id) then
        insert into public.appointment_events (appointment_id, type, payload)
        values (new.id, 'rescheduled',
                jsonb_build_object('from_start', old.start_at, 'to_start', new.start_at,
                                   'from_prof', old.professional_id, 'to_prof', new.professional_id));
    end if;
    return null;
end $$;

create trigger t_appt_audit
    after insert or update on public.appointments
    for each row execute function public.fn_appt_audit();

-- ── Pago! → comissões congeladas + LTV do cliente + lembrete de avaliação ────
create or replace function public.fn_on_payment()
returns trigger language plpgsql as $$
declare
    v_item       record;
    v_prof       uuid;
    v_rate       numeric(5,2);
    v_tip_share  numeric(12,2);
    v_prof_count int;
begin
    if new.status = 'paid' and (old.status is distinct from 'paid') then
        update public.orders
        set status = 'paid', closed_at = now()
        where id = new.order_id;

        -- quantos profissionais participaram da comanda?
        select count(distinct a.professional_id) into v_prof_count
        from public.order_items oi
        join public.appointments a on a.id = (select appointment_id from public.orders where id = new.order_id)
        where oi.order_id = new.order_id and oi.kind = 'service';

        -- gorjeta: 100% ao prof; se comanda múltipla, divide igualmente
        v_tip_share := (select coalesce(tip, 0) from public.orders where id = new.order_id);
        if v_prof_count > 1 then
            v_tip_share := v_tip_share / v_prof_count;
        end if;

        for v_item in
            select a.professional_id,
                   oi.total as base,
                   a.service_id,
                   a.id as appt_id
            from public.order_items oi
            join public.orders o       on o.id = oi.order_id
            join public.appointments a  on a.id = o.appointment_id
            where oi.order_id = new.order_id and oi.kind = 'service'
        loop
            select coalesce(ps.commission_pct_override, s.commission_pct) into v_rate
            from public.services s
            left join public.professional_services ps
              on ps.service_id = s.id and ps.professional_id = v_item.professional_id
            where s.id = v_item.service_id;

            insert into public.commissions
                (org_id, professional_id, transaction_id, appointment_id,
                 rate, base, amount, tip_amount, period)
            values
                (new.org_id, v_item.professional_id, new.id, v_item.appt_id,
                 v_rate / 100.0, v_item.base, v_item.base * v_rate / 100.0,
                 v_tip_share, (new.paid_at at time zone 'America/Sao_Paulo')::date);
        end loop;

        -- métricas cacheadas do cliente
        update public.customers c
        set total_spent   = c.total_spent + new.gross,
            visits_count  = c.visits_count + 1,
            first_visit_at = coalesce(c.first_visit_at, new.paid_at),
            last_visit_at  = new.paid_at
        from public.orders o
        where o.id = new.order_id and c.id = o.customer_id;

        -- pontos: 1 ponto por R$10
        insert into public.loyalty_points (org_id, customer_id, delta, reason, ref_id)
        select new.org_id, o.customer_id, (new.gross / 10)::int, 'payment', new.id
        from public.orders o where o.id = new.order_id;
    end if;
    return null;
end $$;

create trigger t_payment
    after update on public.transactions
    for each row execute function public.fn_on_payment();

