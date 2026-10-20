-- ============================================================================
--  0006 — Estrutura para os módulos autenticados (ADM, Barbeiro, Cliente)
--  Aditivo e idempotente. Não altera nada do que o agendamento público usa.
--
--  Cobre:
--   • produtos: descrição/imagem/exibição na loja + reserva de produto
--   • profissionais: e-mail (login do barbeiro) + vínculo automático com profile
--   • onboarding: create_barbershop() + is_slug_available()
--   • comanda: open/add/close (grava transaction → triggers de comissão/LTV/pontos)
--   • agenda do barbeiro: mudança de status, bloqueio rápido, anotações com fotos
--   • dashboards: admin_summary() / barber_summary() (agregação no banco)
--   • retenção: lost_clients()
--   • fidelidade: status + resgate (cupom de 10 cortes)
-- ============================================================================

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. PRODUTOS — campos que a loja do cliente e o ADM usam
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.products
    add column if not exists description   text,
    add column if not exists image_url     text,
    add column if not exists show_in_store boolean not null default true,
    add column if not exists sort_order    int not null default 0;

create index if not exists idx_products_store
    on public.products (org_id, sort_order) where active and show_in_store;

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. PROFISSIONAIS — e-mail para convidar o login do barbeiro
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.professionals add column if not exists email text;

create index if not exists idx_professionals_email
    on public.professionals (org_id, lower(email));

-- Quando o ADM cadastra o barbeiro com e-mail de um profile já existente,
-- o vínculo acontece sozinho (agenda do barbeiro precisa do user_id).
create or replace function public.fn_link_professional_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if new.email is not null and new.user_id is null then
        select p.id into new.user_id
        from public.profiles p
        where lower(p.email) = lower(new.email)
        limit 1;
    end if;
    return new;
end $$;

drop trigger if exists t_prof_link on public.professionals;
create trigger t_prof_link
    before insert or update of email on public.professionals
    for each row execute function public.fn_link_professional_user();

-- Caminho inverso: o barbeiro se cadastra DEPOIS de já estar na equipe.
-- Nome do trigger ordena depois de on_auth_user_created (o profile já existe).
create or replace function public.fn_link_profile_to_professional()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if new.role = 'barber' then
        update public.professionals
        set user_id = new.id
        where user_id is null
          and lower(email) = lower(new.email)
          and (new.org_id is null or org_id = new.org_id);
    end if;
    return new;
end $$;

drop trigger if exists z_link_professional on public.profiles;
create trigger z_link_professional
    after insert on public.profiles
    for each row execute function public.fn_link_profile_to_professional();

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. RESERVA DE PRODUTO (loja do cliente)
-- ═════════════════════════════════════════════════════════════════════════════

do $$ begin
    create type public.reservation_status as enum ('reserved', 'picked_up', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.product_reservations (
    id             uuid primary key default gen_random_uuid(),
    org_id         uuid not null references public.organizations (id) on delete cascade,
    product_id     uuid not null references public.products (id) on delete cascade,
    customer_id    uuid not null references public.customers (id) on delete cascade,
    appointment_id uuid references public.appointments (id) on delete set null,
    qty            int not null default 1 check (qty > 0),
    unit_price     numeric(12,2) not null,        -- preço congelado na reserva
    status         public.reservation_status not null default 'reserved',
    note           text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_reservations_org  on public.product_reservations (org_id, status);
create index if not exists idx_reservations_cust on public.product_reservations (customer_id, created_at desc);

drop trigger if exists t_reserv_updated on public.product_reservations;
create trigger t_reserv_updated before update on public.product_reservations
    for each row execute function public.set_updated_at();

alter table public.product_reservations enable row level security;

drop policy if exists reserv_staff on public.product_reservations;
create policy reserv_staff on public.product_reservations for all
    using (is_staff(org_id)) with check (is_staff(org_id));

drop policy if exists reserv_self on public.product_reservations;
create policy reserv_self on public.product_reservations for all
    using (customer_id = public.my_customer_id(org_id))
    with check (customer_id = public.my_customer_id(org_id));

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. ONBOARDING DE BARBEARIA
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.is_slug_available(p_slug text)
returns boolean language sql stable security definer set search_path = public as $$
    select p_slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$'
       and not exists (select 1 from organizations o where o.slug = p_slug)
$$;

grant execute on function public.is_slug_available(text) to anon, authenticated;

-- Cria a barbearia e promove o usuário logado a owner.
-- Fluxo: signUp(role=owner) → create_barbershop() → expediente padrão seg–sáb.
create or replace function public.create_barbershop(
    p_name    text,
    p_slug    text,
    p_phone   text default null,
    p_address jsonb default '{}'::jsonb
)
returns table (org_id uuid, slug text)
language plpgsql security definer set search_path = public as $$
declare
    v_uid uuid := auth.uid();
    v_org uuid;
begin
    if v_uid is null then
        raise exception 'auth_required' using errcode = '28000';
    end if;
    if coalesce(trim(p_name), '') = '' then
        raise exception 'invalid_name' using errcode = '22023';
    end if;
    if not public.is_slug_available(p_slug) then
        raise exception 'slug_unavailable' using errcode = '23505';
    end if;

    insert into public.organizations (name, slug, phone, address)
    values (trim(p_name), p_slug, p_phone, coalesce(p_address, '{}'::jsonb))
    returning id into v_org;

    insert into public.profiles (id, org_id, role, full_name, phone, email)
    select v_uid, v_org, 'owner',
           coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
           p_phone, u.email
    from auth.users u where u.id = v_uid
    on conflict (id) do update
        set org_id = v_org, role = 'owner',
            phone = coalesce(profiles.phone, excluded.phone), updated_at = now();

    -- expediente padrão: seg(1) a sáb(6), 09:00–20:00
    insert into public.availability_rules (org_id, professional_id, weekday, start_time, end_time)
    select v_org, null, d, time '09:00', time '20:00'
    from generate_series(1, 6) as d;

    return query select v_org, p_slug;
end $$;

revoke execute on function public.create_barbershop(text, text, text, jsonb) from public, anon;
grant execute on function public.create_barbershop(text, text, text, jsonb) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. COMANDA — abrir, adicionar item, fechar e pagar
-- ═════════════════════════════════════════════════════════════════════════════

-- Recalcula subtotal/total a partir dos itens + desconto + gorjeta
create or replace function public.recalc_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
    update public.orders o
    set subtotal = coalesce((select sum(total) from public.order_items where order_id = p_order), 0),
        total    = coalesce((select sum(total) from public.order_items where order_id = p_order), 0)
                   - o.discount + o.tip,
        updated_at = now()
    where o.id = p_order;
end $$;

create or replace function public.open_comanda(p_appointment uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
    v_uid   uuid := auth.uid();
    v_appt  record;
    v_order uuid;
begin
    select * into v_appt from public.appointments where id = p_appointment;
    if not found then raise exception 'invalid_appointment' using errcode = '22023'; end if;
    if not public.is_staff(v_appt.org_id) then
        raise exception 'forbidden' using errcode = '42501';
    end if;

    select id into v_order from public.orders
    where appointment_id = p_appointment and status = 'open';
    if v_order is not null then return v_order; end if;

    insert into public.orders (org_id, appointment_id, customer_id, status, subtotal, total, created_by)
    values (v_appt.org_id, p_appointment, v_appt.customer_id, 'open', 0, 0, v_uid)
    returning id into v_order;

    -- serviço do agendamento já entra na comanda (preço congelado do snapshot)
    insert into public.order_items (order_id, kind, ref_id, name, qty, unit_price, added_by)
    values (v_order, 'service', v_appt.service_id, v_appt.service_name, 1,
            v_appt.service_price, v_uid);

    perform public.recalc_order(v_order);
    return v_order;
end $$;

create or replace function public.add_comanda_item(
    p_order uuid,
    p_kind  public.order_item_kind,
    p_ref   uuid,
    p_qty   int default 1
)
returns numeric language plpgsql security definer set search_path = public as $$
declare
    v_uid   uuid := auth.uid();
    v_order record;
    v_name  text;
    v_price numeric(12,2);
begin
    select * into v_order from public.orders where id = p_order;
    if not found then raise exception 'invalid_order' using errcode = '22023'; end if;
    if not public.is_staff(v_order.org_id) then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    if v_order.status <> 'open' then
        raise exception 'order_closed' using errcode = '22023';
    end if;
    if p_qty < 1 then raise exception 'invalid_qty' using errcode = '22023'; end if;

    if p_kind = 'product' then
        select name, price into v_name, v_price
        from public.products where id = p_ref and org_id = v_order.org_id and active;
        if v_name is null then raise exception 'invalid_product' using errcode = '22023'; end if;
    else
        select name, coalesce(ps.price_override, s.price) into v_name, v_price
        from public.services s
        left join public.professional_services ps
          on ps.service_id = s.id
         and ps.professional_id = (select professional_id from public.appointments
                                   where id = v_order.appointment_id)
        where s.id = p_ref and s.org_id = v_order.org_id and s.active;
        if v_name is null then raise exception 'invalid_service' using errcode = '22023'; end if;
    end if;

    insert into public.order_items (order_id, kind, ref_id, name, qty, unit_price, added_by)
    values (p_order, p_kind, p_ref, v_name, p_qty, v_price, v_uid);

    perform public.recalc_order(p_order);
    return (select total from public.orders where id = p_order);
end $$;

create or replace function public.remove_comanda_item(p_item uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare
    v_order uuid;
    v_org   uuid;
begin
    select oi.order_id, o.org_id into v_order, v_org
    from public.order_items oi join public.orders o on o.id = oi.order_id
    where oi.id = p_item;
    if v_order is null then raise exception 'invalid_item' using errcode = '22023'; end if;
    if not public.is_staff(v_org) then raise exception 'forbidden' using errcode = '42501'; end if;

    delete from public.order_items where id = p_item;
    perform public.recalc_order(v_order);
    return (select total from public.orders where id = v_order);
end $$;

-- Fecha a comanda: grava a transação PAGA (trigger fn_on_payment congela
-- comissão, atualiza LTV/visitas/pontos) e finaliza o agendamento.
create or replace function public.close_comanda(
    p_order  uuid,
    p_method public.payment_method default 'cash',
    p_tip    numeric default 0,
    p_discount numeric default 0
)
returns table (order_id uuid, total numeric, transaction_id uuid)
language plpgsql security definer set search_path = public as $$
declare
    v_uid uuid := auth.uid();
    v_order record;
    v_tx  uuid;
    v_tot numeric(12,2);
begin
    select * into v_order from public.orders where id = p_order;
    if not found then raise exception 'invalid_order' using errcode = '22023'; end if;
    if not public.is_staff(v_order.org_id) then raise exception 'forbidden' using errcode = '42501'; end if;
    if v_order.status <> 'open' then raise exception 'order_closed' using errcode = '22023'; end if;
    if p_tip < 0 or p_discount < 0 then raise exception 'invalid_amount' using errcode = '22023'; end if;

    update public.orders set tip = p_tip, discount = p_discount where id = p_order;
    perform public.recalc_order(p_order);
    select total into v_tot from public.orders where id = p_order;
    if v_tot < 0 then raise exception 'invalid_discount' using errcode = '22023'; end if;

    insert into public.transactions (org_id, order_id, method, gross, status, gateway, paid_at)
    values (v_order.org_id, p_order, p_method, v_tot, 'paid', 'manual', now())
    returning id into v_tx;

    -- baixa de estoque dos produtos vendidos
    update public.products p
    set stock_qty = greatest(coalesce(p.stock_qty, 0) - agg.qty, 0)
    from (
        select oi.ref_id, sum(oi.qty)::int as qty
        from public.order_items oi
        where oi.order_id = p_order and oi.kind = 'product' and oi.ref_id is not null
        group by oi.ref_id
    ) agg
    where p.id = agg.ref_id and p.track_stock;

    if v_order.appointment_id is not null then
        update public.appointments set status = 'completed'
        where id = v_order.appointment_id
          and status not in ('cancelled', 'no_show', 'completed');
    end if;

    return query select p_order, v_tot, v_tx;
end $$;

grant execute on function public.open_comanda(uuid)                                   to authenticated;
grant execute on function public.add_comanda_item(uuid, public.order_item_kind, uuid, int) to authenticated;
grant execute on function public.remove_comanda_item(uuid)                            to authenticated;
grant execute on function public.close_comanda(uuid, public.payment_method, numeric, numeric) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 6. AGENDA DO BARBEIRO — status, bloqueio rápido e anotações com fotos
-- ═════════════════════════════════════════════════════════════════════════════

-- Transições válidas: o barbeiro não "pula" de confirmado para finalizado.
create or replace function public.set_appointment_status(
    p_appointment uuid,
    p_status      public.appointment_status
)
returns public.appointment_status
language plpgsql security definer set search_path = public as $$
declare
    v_appt record;
begin
    select * into v_appt from public.appointments where id = p_appointment;
    if not found then raise exception 'invalid_appointment' using errcode = '22023'; end if;
    if not public.is_staff(v_appt.org_id) then
        raise exception 'forbidden' using errcode = '42501';
    end if;

    if p_status = v_appt.status then return p_status; end if;

    if not (
        (v_appt.status in ('pending', 'confirmed') and p_status in ('checked_in', 'in_progress', 'no_show', 'cancelled'))
        or (v_appt.status = 'checked_in'  and p_status in ('in_progress', 'completed', 'no_show', 'cancelled'))
        or (v_appt.status = 'in_progress' and p_status in ('completed', 'cancelled'))
    ) then
        raise exception 'invalid_transition' using errcode = '22023';
    end if;

    update public.appointments set status = p_status where id = p_appointment;
    return p_status;
end $$;

grant execute on function public.set_appointment_status(uuid, public.appointment_status) to authenticated;

-- Bloqueio rápido (intervalo extra / saída de emergência) para o próprio barbeiro
create or replace function public.block_my_time(
    p_start  timestamptz,
    p_end    timestamptz,
    p_reason text default 'Bloqueio rápido'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
    v_uid  uuid := auth.uid();
    v_prof uuid;
    v_org  uuid;
    v_id   uuid;
begin
    if v_uid is null then raise exception 'auth_required' using errcode = '28000'; end if;
    if p_start >= p_end then raise exception 'invalid_range' using errcode = '22023'; end if;

    select id, org_id into v_prof, v_org
    from public.professionals where user_id = v_uid
    order by active desc limit 1;

    if v_prof is null then raise exception 'not_a_professional' using errcode = '22023'; end if;

    insert into public.time_off (org_id, professional_id, starts_at, ends_at, reason, created_by)
    values (v_org, v_prof, p_start, p_end, p_reason, v_uid)
    returning id into v_id;

    return v_id;
end $$;

grant execute on function public.block_my_time(timestamptz, timestamptz, text) to authenticated;

-- Anotação do atendimento (com fotos do corte) — alimenta o histórico do cliente
create or replace function public.add_appointment_note(
    p_appointment uuid,
    p_text        text,
    p_photos      text[] default '{}'
)
returns void language plpgsql security definer set search_path = public as $$
declare
    v_uid  uuid := auth.uid();
    v_appt record;
begin
    select * into v_appt from public.appointments where id = p_appointment;
    if not found then raise exception 'invalid_appointment' using errcode = '22023'; end if;
    if not public.is_staff(v_appt.org_id) then
        raise exception 'forbidden' using errcode = '42501';
    end if;

    insert into public.appointment_events (appointment_id, actor_id, type, payload)
    values (p_appointment, v_uid, 'note',
            jsonb_build_object('text', coalesce(p_text, ''),
                               'photos', coalesce(to_jsonb(p_photos), '[]'::jsonb)));
end $$;

grant execute on function public.add_appointment_note(uuid, text, text[]) to authenticated;

-- O cliente enxerga as anotações dos próprios atendimentos (histórico com fotos)
drop policy if exists appt_ev_self on public.appointment_events;
create policy appt_ev_self on public.appointment_events for select
    using (appointment_id in (
        select a.id from public.appointments a
        where a.customer_id = public.my_customer_id(a.org_id)));

-- ═════════════════════════════════════════════════════════════════════════════
-- 7. DASHBOARDS (agregação no banco — menos payload, contas consistentes)
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.admin_summary(p_org uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
    v_tz   text := coalesce((select timezone from organizations where id = p_org), 'America/Sao_Paulo');
    v_gross numeric(12,2);
    v_fee   numeric(12,2);
    v_tips  numeric(12,2);
    v_comm  numeric(12,2);
    v_comm_pending numeric(12,2);
begin
    if not public.is_staff(p_org) then
        raise exception 'forbidden' using errcode = '42501';
    end if;

    select coalesce(sum(t.gross), 0), coalesce(sum(t.fee), 0)
    into v_gross, v_fee
    from public.transactions t
    where t.org_id = p_org and t.status = 'paid'
      and ((t.paid_at at time zone v_tz)::date between p_from and p_to);

    select coalesce(sum(o.tip), 0) into v_tips
    from public.transactions t join public.orders o on o.id = t.order_id
    where t.org_id = p_org and t.status = 'paid'
      and ((t.paid_at at time zone v_tz)::date between p_from and p_to);

    select coalesce(sum(c.amount), 0),
           coalesce(sum(c.amount) filter (where c.status = 'pending'), 0)
    into v_comm, v_comm_pending
    from public.commissions c
    where c.org_id = p_org and c.period between p_from and p_to;

    return jsonb_build_object(
        'gross', v_gross,
        'fee', v_fee,
        'net', v_gross - v_fee,
        'tips', v_tips,
        'commissions', v_comm,
        'commissions_pending', v_comm_pending,
        'result', v_gross - v_fee - v_comm,
        'appointments', (
            select jsonb_object_agg(s.status, s.qty) from (
                select a.status::text as status, count(*)::int as qty
                from public.appointments a
                where a.org_id = p_org
                  and ((a.start_at at time zone v_tz)::date between p_from and p_to)
                group by a.status) s),
        'by_day', (
            select coalesce(jsonb_agg(row_to_json(d) order by d.day), '[]'::jsonb) from (
                select (t.paid_at at time zone v_tz)::date as day,
                       sum(t.gross) as gross, sum(t.fee) as fee, sum(t.gross - t.fee) as net
                from public.transactions t
                where t.org_id = p_org and t.status = 'paid'
                  and ((t.paid_at at time zone v_tz)::date between p_from and p_to)
                group by 1) d),
        'by_service', (
            select coalesce(jsonb_agg(row_to_json(s) order by s.amount desc), '[]'::jsonb) from (
                select a.service_name as name,
                       count(*)::int as qty,
                       sum(a.service_price) as amount
                from public.appointments a
                where a.org_id = p_org and a.status = 'completed'
                  and ((a.start_at at time zone v_tz)::date between p_from and p_to)
                group by a.service_name) s),
        'by_professional', (
            select coalesce(jsonb_agg(row_to_json(p) order by p.amount desc), '[]'::jsonb) from (
                select pr.full_name as name, pr.color,
                       count(a.id)::int as cuts,
                       coalesce(sum(a.service_price), 0) as amount,
                       coalesce((select sum(c.amount) from public.commissions c
                                 where c.professional_id = pr.id and c.period between p_from and p_to), 0) as commission,
                       coalesce((select sum(c.tip_amount) from public.commissions c
                                 where c.professional_id = pr.id and c.period between p_from and p_to), 0) as tips
                from public.professionals pr
                left join public.appointments a
                  on a.professional_id = pr.id and a.status = 'completed'
                 and ((a.start_at at time zone v_tz)::date between p_from and p_to)
                where pr.org_id = p_org and pr.active
                group by pr.id, pr.full_name, pr.color) p),
        'occupancy', (
            select coalesce(jsonb_agg(row_to_json(o) order by o.day), '[]'::jsonb) from (
                select d.day,
                       coalesce(sum(extract(epoch from (a.end_at - a.start_at)) / 60), 0)::int as busy_min,
                       coalesce((select count(*) from public.professionals pr2
                                 where pr2.org_id = p_org and pr2.active), 0)::int as chairs
                from (select generate_series(p_from, p_to, interval '1 day')::date as day) d
                left join public.appointments a
                  on a.org_id = p_org
                 and a.status in ('confirmed', 'checked_in', 'in_progress', 'completed')
                 and (a.start_at at time zone v_tz)::date = d.day
                group by d.day) o)
    );
end $$;

grant execute on function public.admin_summary(uuid, date, date) to authenticated;

create or replace function public.barber_summary(p_professional uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
    v_org  uuid;
    v_tz   text;
begin
    select org_id into v_org from public.professionals where id = p_professional;
    if v_org is null then raise exception 'invalid_professional' using errcode = '22023'; end if;
    if not (public.is_staff(v_org) or exists (
        select 1 from public.professionals where id = p_professional and user_id = auth.uid()
    )) then
        raise exception 'forbidden' using errcode = '42501';
    end if;

    v_tz := coalesce((select timezone from organizations where id = v_org), 'America/Sao_Paulo');

    return jsonb_build_object(
        'commission', coalesce((select sum(c.amount) from public.commissions c
                                where c.professional_id = p_professional and c.period between p_from and p_to), 0),
        'tips', coalesce((select sum(c.tip_amount) from public.commissions c
                          where c.professional_id = p_professional and c.period between p_from and p_to), 0),
        'pending', coalesce((select sum(c.amount + c.tip_amount) from public.commissions c
                             where c.professional_id = p_professional
                               and c.period between p_from and p_to and c.status = 'pending'), 0),
        'sold', coalesce((select sum(c.base) from public.commissions c
                          where c.professional_id = p_professional and c.period between p_from and p_to), 0),
        'cuts', coalesce((select count(*) from public.appointments a
                          where a.professional_id = p_professional and a.status = 'completed'
                            and ((a.start_at at time zone v_tz)::date between p_from and p_to)), 0),
        'no_shows', coalesce((select count(*) from public.appointments a
                              where a.professional_id = p_professional and a.status = 'no_show'
                                and ((a.start_at at time zone v_tz)::date between p_from and p_to)), 0),
        'by_weekday', (
            select coalesce(jsonb_agg(row_to_json(w) order by w.dow), '[]'::jsonb) from (
                select extract(dow from (a.start_at at time zone v_tz))::int as dow,
                       count(*)::int as qty,
                       coalesce(sum(a.service_price), 0) as amount
                from public.appointments a
                where a.professional_id = p_professional and a.status = 'completed'
                  and ((a.start_at at time zone v_tz)::date between p_from and p_to)
                group by 1) w),
        'daily', (
            select coalesce(jsonb_agg(row_to_json(d) order by d.day), '[]'::jsonb) from (
                select (c.period) as day, sum(c.amount) as commission, sum(c.tip_amount) as tips
                from public.commissions c
                where c.professional_id = p_professional and c.period between p_from and p_to
                group by c.period) d)
    );
end $$;

grant execute on function public.barber_summary(uuid, date, date) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 8. RETENÇÃO — clientes sumidos
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.lost_clients(p_org uuid, p_days int default 30)
returns table (
    customer_id  uuid,
    full_name    text,
    phone        text,
    last_visit_at timestamptz,
    days_away    int,
    visits_count int,
    total_spent  numeric,
    last_service text,
    preferred_professional text
)
language plpgsql stable security definer set search_path = public as $$
begin
    if not public.is_staff(p_org) then
        raise exception 'forbidden' using errcode = '42501';
    end if;

    return query
    select c.id,
           c.full_name,
           c.phone,
           c.last_visit_at,
           coalesce(extract(day from now() - c.last_visit_at)::int, 999) as days_away,
           c.visits_count,
           c.total_spent,
           (select a.service_name from public.appointments a
            where a.customer_id = c.id and a.status = 'completed'
            order by a.start_at desc limit 1) as last_service,
           (select pr.full_name from public.appointments a
            join public.professionals pr on pr.id = a.professional_id
            where a.customer_id = c.id
            order by a.start_at desc limit 1) as preferred_professional
    from public.customers c
    where c.org_id = p_org
      and c.allows_marketing
      and (c.last_visit_at is null or c.last_visit_at < now() - make_interval(days => p_days))
      and not exists (
          select 1 from public.appointments a
          where a.customer_id = c.id
            and a.start_at > now()
            and a.status in ('pending', 'confirmed', 'checked_in'))
    order by c.last_visit_at desc nulls last
    limit 100;
end $$;

grant execute on function public.lost_clients(uuid, int) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 9. FIDELIDADE — cartão de 10 cortes com cupom
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.customers
    add column if not exists loyalty_rewards_count int not null default 0;

-- Um resgate por vez: consumiu 10 visitas desde o último cupom?
create or replace function public.my_loyalty(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
    v_customer uuid := public.my_customer_id(p_org);
    v_cust     record;
    v_target   int := 10;
    v_progress int;
begin
    if v_customer is null then
        return jsonb_build_object('linked', false, 'target', v_target, 'progress', 0,
                                  'available', false, 'rewards', 0, 'code', null,
                                  'points', 0, 'visits', 0, 'total_spent', 0);
    end if;

    select * into v_cust from public.customers where id = v_customer;
    v_progress := greatest(v_cust.visits_count - (v_cust.loyalty_rewards_count * v_target), 0);

    return jsonb_build_object(
        'linked', true,
        'target', v_target,
        'progress', least(v_progress, v_target),
        'available', v_progress >= v_target,
        'rewards', v_cust.loyalty_rewards_count,
        'code', case when v_progress >= v_target
                     then 'CORTE-' || upper(substring(replace(v_cust.id::text, '-', ''), 1, 6))
                     else null end,
        'points', public.customer_points_balance(v_customer),
        'visits', v_cust.visits_count,
        'total_spent', v_cust.total_spent,
        'first_visit_at', v_cust.first_visit_at
    );
end $$;

create or replace function public.redeem_loyalty_reward(p_org uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
    v_customer uuid := public.my_customer_id(p_org);
    v_cust     record;
    v_target   int := 10;
begin
    if v_customer is null then raise exception 'customer_only' using errcode = '22023'; end if;
    select * into v_cust from public.customers where id = v_customer;

    if v_cust.visits_count - (v_cust.loyalty_rewards_count * v_target) < v_target then
        raise exception 'reward_unavailable' using errcode = '22023';
    end if;

    update public.customers
    set loyalty_rewards_count = loyalty_rewards_count + 1
    where id = v_customer;

    insert into public.loyalty_points (org_id, customer_id, delta, reason, ref_id)
    values (p_org, v_customer, 0, 'reward_redeemed', v_customer);

    return 'CORTE-' || upper(substring(replace(v_customer::text, '-', ''), 1, 6));
end $$;

grant execute on function public.my_loyalty(uuid)            to authenticated;
grant execute on function public.redeem_loyalty_reward(uuid) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 10. LOJA — reserva de produto para retirada presencial
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.reserve_product(p_org uuid, p_product uuid, p_qty int default 1)
returns uuid language plpgsql security definer set search_path = public as $$
declare
    v_customer uuid := public.my_customer_id(p_org);
    v_prod     record;
    v_appt     uuid;
    v_id       uuid;
begin
    if auth.uid() is null then raise exception 'auth_required' using errcode = '28000'; end if;
    if v_customer is null then raise exception 'customer_only' using errcode = '22023'; end if;
    if p_qty < 1 then raise exception 'invalid_qty' using errcode = '22023'; end if;

    select * into v_prod from public.products
    where id = p_product and org_id = p_org and active and show_in_store;
    if not found then raise exception 'invalid_product' using errcode = '22023'; end if;

    if v_prod.track_stock and coalesce(v_prod.stock_qty, 0) <= 0 then
        raise exception 'out_of_stock' using errcode = '22023';
    end if;

    -- vincula ao próximo agendamento do cliente, se houver
    select id into v_appt from public.appointments
    where customer_id = v_customer and start_at > now()
      and status in ('pending', 'confirmed', 'checked_in')
    order by start_at limit 1;

    insert into public.product_reservations
        (org_id, product_id, customer_id, appointment_id, qty, unit_price, note)
    values
        (p_org, p_product, v_customer, v_appt, p_qty, v_prod.price,
         case when v_appt is not null then 'Retirar no próximo agendamento'
              else 'Retirar na barbearia' end)
    returning id into v_id;

    return v_id;
end $$;

grant execute on function public.reserve_product(uuid, uuid, int) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 11. HORÁRIO LIVRE DO BARBEIRO (base para bloqueio rápido na agenda)
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.my_professional_id()
returns uuid language sql stable security definer set search_path = public as $$
    select id from public.professionals where user_id = auth.uid() and active
    order by sort_order limit 1
$$;

grant execute on function public.my_professional_id() to authenticated;
