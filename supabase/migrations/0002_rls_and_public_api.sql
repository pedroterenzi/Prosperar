-- ═════════════════════════════════════════════════════════════════════════════
-- 14. VIEWS PÚBLICAS DE CATÁLOGO (agendamento sem login)
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.get_org_by_slug(p_slug text)
returns table (id uuid, name text, phone text, timezone text, logo_url text)
language sql stable security definer set search_path = public as $$
    select id, name, phone, timezone, logo_url
    from organizations where slug = p_slug and updated_at is not null
$$;

-- Catálogo público: só dados que o marketing expõe
create or replace function public.get_public_catalog(p_org uuid)
returns table (service_id uuid, service_name text, duration_min int, price numeric,
               professional_id uuid, professional_name text, professional_color text)
language sql stable security definer set search_path = public as $$
    select s.id, s.name, s.duration_min, s.price, p.id, p.full_name, p.color
    from services s
    cross join professionals p
    left join professional_services ps on ps.service_id = s.id and ps.professional_id = p.id
    where s.org_id = p_org and s.active and p.active
      and (ps.active is distinct from false)
    order by s.sort_order, p.sort_order
$$;

-- Slots disponíveis: expediente − time_off − agendamentos existentes
create or replace function public.get_available_slots(
    p_org uuid, p_professional uuid, p_date date, p_duration_min int
)
returns table (slot_start timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
    v_tz       text := (select timezone from organizations where id = p_org);
    v_interval int  := (select (settings->>'slot_interval_min')::int
                        from organizations where id = p_org);
    v_cursor   timestamptz;
    v_end      timestamptz;
begin
    v_cursor := (p_date::timestamp at time zone v_tz);
    v_end    := v_cursor + interval '1 day';

    return query
    with rules as (
        select r.start_time, r.end_time
        from availability_rules r
        where r.org_id = p_org
          and (r.professional_id is null or r.professional_id = p_professional)
          and r.weekday = extract(dow from p_date::timestamp at time zone v_tz)
          and (r.valid_from is null or r.valid_from <= p_date)
          and (r.valid_to   is null or r.valid_to   >= p_date)
    ),
    busy as (
        select tstzrange(a.start_at, a.end_at) as r
        from appointments a
        where a.org_id = p_org and a.professional_id = p_professional
          and a.status in ('pending','confirmed','checked_in','in_progress')
          and a.start_at < v_end and a.end_at > v_cursor
        union all
        select tstzrange(t.starts_at, t.ends_at)
        from time_off t
        where t.org_id = p_org
          and (t.professional_id is null or t.professional_id = p_professional)
          and t.starts_at < v_end and t.ends_at > v_cursor
    ),
    slots as (
        select generate_series(
            v_cursor + r.start_time,
            v_cursor + r.end_time - make_interval(mins => p_duration_min),
            make_interval(mins => coalesce(v_interval, 30))
        ) as slot
        from rules r
    )
    select s.slot
    from slots s
    where s.slot > now()
      and not exists (select 1 from busy b where b.r && tstzrange(s.slot, s.slot + make_interval(mins => p_duration_min)))
    order by s.slot;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 15. ROW LEVEL SECURITY
--     Nível de banco impede vazamento entre tenants e clientes.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── helpers (security definer evita recursão de policies) ───────────────────
create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from profiles where id = auth.uid() and org_id = p_org and role <> 'client'
    ) $$;

create or replace function public.is_org_owner(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from profiles where id = auth.uid() and org_id = p_org and role = 'owner'
    ) $$;

create or replace function public.is_staff(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from profiles
        where id = auth.uid() and org_id = p_org
          and role in ('owner','barber','receptionist')
    ) $$;

create or replace function public.my_customer_id(p_org uuid)
returns uuid language sql stable security definer set search_path = public as $$
    select id from customers where user_id = auth.uid() and org_id = p_org $$;

create or replace function public.my_role()
returns public.app_role language sql stable security definer set search_path = public as $$
    select role from profiles where id = auth.uid() $$;

alter table public.organizations      enable row level security;
alter table public.profiles           enable row level security;
alter table public.professionals      enable row level security;
alter table public.services           enable row level security;
alter table public.professional_services enable row level security;
alter table public.products           enable row level security;
alter table public.customers          enable row level security;
alter table public.availability_rules enable row level security;
alter table public.time_off           enable row level security;
alter table public.appointments       enable row level security;
alter table public.appointment_events enable row level security;
alter table public.orders             enable row level security;
alter table public.order_items        enable row level security;
alter table public.transactions       enable row level security;
alter table public.commissions        enable row level security;
alter table public.expenses           enable row level security;
alter table public.plans              enable row level security;
alter table public.subscriptions      enable row level security;
alter table public.credit_ledger      enable row level security;
alter table public.loyalty_points     enable row level security;
alter table public.notifications      enable row level security;
alter table public.reminder_queue     enable row level security;

-- organizations
create policy org_select on public.organizations for select
    using (is_org_member(id) or exists (
        select 1 from customers c where c.user_id = auth.uid() and c.org_id = organizations.id));
create policy org_update on public.organizations for update using (is_org_owner(id));

-- profiles
create policy prof_select_own on public.profiles for select using (id = auth.uid());
create policy prof_select_org on public.profiles for select using (is_org_member(org_id));
create policy prof_update_own on public.profiles for update using (id = auth.uid())
    with check (id = auth.uid() and role = public.my_role()); -- ninguém se promove
create policy prof_owner_mgmt on public.profiles for update using (is_org_owner(org_id));

-- staff
create policy prof_read_staff on public.professionals for select
    using (is_staff(org_id) or exists (
        select 1 from customers c where c.user_id = auth.uid() and c.org_id = professionals.org_id));
create policy prof_write_owner on public.professionals for all using (is_org_owner(org_id)) with check (is_org_owner(org_id));

-- catálogo
create policy serv_read on public.services for select using (is_staff(org_id) or is_org_owner(org_id));
create policy serv_write on public.services for all using (is_org_owner(org_id)) with check (is_org_owner(org_id));
create policy ps_read  on public.professional_services for select using (is_staff(org_id));
create policy ps_write on public.professional_services for all using (is_org_owner(org_id)) with check (is_org_owner(org_id));
create policy prod_read on public.products for select using (is_staff(org_id));
create policy prod_write on public.products for all using (is_org_owner(org_id)) with check (is_org_owner(org_id));

-- customers: staff do org CRUD; cliente vê/cria o próprio
create policy cust_staff on public.customers for all using (is_staff(org_id)) with check (is_staff(org_id));
create policy cust_self_select on public.customers for select using (user_id = auth.uid());
create policy cust_self_insert on public.customers for insert with check (user_id = auth.uid());
create policy cust_self_update on public.customers for update using (user_id = auth.uid());

-- disponibilidade
create policy avail_read  on public.availability_rules for select using (is_staff(org_id));
create policy avail_write on public.availability_rules for all using (is_org_owner(org_id)) with check (is_org_owner(org_id));
create policy off_read  on public.time_off for select using (is_staff(org_id));
create policy off_write on public.time_off for all using (is_staff(org_id)) with check (is_staff(org_id));

-- appointments: cliente vê o próprio (via customers.user_id), staff vê tudo do org
create policy appt_staff on public.appointments for all using (is_staff(org_id)) with check (is_staff(org_id));
create policy appt_self_select on public.appointments for select
    using (customer_id = public.my_customer_id(org_id));
create policy appt_self_insert on public.appointments for insert
    with check (customer_id = public.my_customer_id(org_id) and source = 'client');
create policy appt_self_update on public.appointments for update
    using (customer_id = public.my_customer_id(org_id))
    with check (customer_id = public.my_customer_id(org_id));

create policy appt_ev_staff on public.appointment_events for select using (is_staff(org_id));

-- orders / items / transactions / commissions
create policy order_staff on public.orders for all using (is_staff(org_id)) with check (is_staff(org_id));
create policy order_self on public.orders for select
    using (customer_id = public.my_customer_id(org_id));
create policy item_staff on public.order_items for all
    using (is_staff((select org_id from orders where id = order_id)))
    with check (is_staff((select org_id from orders where id = order_id)));
create policy tx_staff on public.transactions for select using (is_staff(org_id));
create policy tx_owner  on public.transactions for insert with check (is_org_owner(org_id) or is_staff(org_id)); -- webhook usa service_role (bypass RLS)
create policy comm_self  on public.commissions for select
    using (is_staff(org_id) or professional_id in (
        select id from professionals where user_id = auth.uid()));
create policy comm_owner on public.commissions for update using (is_org_owner(org_id));
create policy exp_read  on public.expenses for select using (is_org_owner(org_id));
create policy exp_write on public.expenses for all using (is_org_owner(org_id)) with check (is_org_owner(org_id));

-- fidelidade
create policy plan_read  on public.plans for select using (is_staff(org_id));
create policy plan_write on public.plans for all using (is_org_owner(org_id)) with check (is_org_owner(org_id));
create policy sub_staff on public.subscriptions for select using (is_staff(org_id));
create policy sub_self  on public.subscriptions for select using (customer_id = public.my_customer_id(org_id));
create policy sub_owner on public.subscriptions for all using (is_org_owner(org_id)) with check (is_org_owner(org_id));
create policy ledger_staff on public.credit_ledger for select using (is_staff(org_id));
create policy points_staff on public.loyalty_points for select using (is_staff(org_id));
create policy points_self  on public.loyalty_points for select using (customer_id = public.my_customer_id(org_id));

-- infra (escrita apenas via service_role / workers)
create policy notif_read_staff on public.notifications for select using (is_staff(org_id));
create policy remind_read_staff on public.reminder_queue for select using (is_staff(org_id));

-- ═════════════════════════════════════════════════════════════════════════════
-- 16. BOOTSTRAP: cria a org + owner a partir do signup (executar no SQL editor)
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    insert into public.profiles (id, org_id, role, full_name, phone, email)
    values (new.id,
            new.raw_user_meta_data ->> 'org_id',
            coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'client'),
            coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.phone, '@', 1)),
            new.phone,
            new.email);
    return new;
end $$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- Fim do migration 0001
