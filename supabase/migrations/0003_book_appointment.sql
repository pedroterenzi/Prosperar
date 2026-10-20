-- ============================================================================
--  0003 — Agendamento público com OTP (conecta o fluxo Zero Friction)
--  RPC SECURITY DEFINER: upsert do customer + INSERT em appointments com
--  as proteções do banco (EXCLUDE anti double-booking, snapshot e lembretes
--  disparados pelos triggers do 0001). Executada só por usuário autenticado
--  via OTP de telefone — nenhuma senha é criada.
-- ============================================================================

create or replace function public.book_appointment(
    p_org              uuid,
    p_service_id       uuid,
    p_professional_id  uuid,
    p_start_at         timestamptz,
    p_phone            text,
    p_full_name        text default null
)
returns table (appointment_id uuid, reschedule_token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid      uuid := auth.uid();
    v_customer uuid;
    v_id       uuid;
    v_token    uuid;
begin
    -- 1) identidade: só quem passou pelo OTP
    if v_uid is null then
        raise exception 'auth_required' using errcode = '28000';
    end if;
    if p_phone !~ '^\+[1-9]\d{10,14}$' then
        raise exception 'invalid_phone' using errcode = '22023';
    end if;
    if p_start_at <= now() then
        raise exception 'slot_in_past' using errcode = '22023';
    end if;

    -- 2) catálogo pertence à org e está ativo
    if not exists (
        select 1 from services s
        where s.id = p_service_id and s.org_id = p_org and s.active
    ) then
        raise exception 'invalid_service' using errcode = '22023';
    end if;
    if not exists (
        select 1 from professionals p
        where p.id = p_professional_id and p.org_id = p_org and p.active
    ) then
        raise exception 'invalid_professional' using errcode = '22023';
    end if;

    -- 3) customer identificado por telefone na org (vincula à conta OTP)
    insert into public.customers (org_id, user_id, full_name, phone)
    values (p_org, v_uid, coalesce(p_full_name, 'Cliente'), p_phone)
    on conflict (org_id, phone)
    do update set user_id = coalesce(customers.user_id, excluded.user_id)
    returning id into v_customer;

    -- 4) INSERT em appointments — o banco garante o slot único.
    --    Dispara: fn_appt_snapshot (preço/duração + lembretes) e fn_appt_audit.
    begin
        insert into public.appointments
            (org_id, customer_id, professional_id, service_id,
             start_at, source, created_by)
        values
            (p_org, v_customer, p_professional_id, p_service_id,
             p_start_at, 'client', v_uid)
        returning id, reschedule_token into v_id, v_token;
    exception
        when exclusion_violation then
            -- outra pessoa pegou o horário entre GET /slots e o POST
            raise exception 'slot_unavailable' using errcode = '23P01';
    end;

    return query select v_id, v_token;
end $$;

revoke execute on function public.book_appointment(uuid, uuid, uuid, timestamptz, text, text)
    from public, anon;
grant execute on function public.book_appointment(uuid, uuid, uuid, timestamptz, text, text)
    to authenticated, service_role;

-- Confirmação do agendamento sem login (link mágico enviado no WhatsApp)
create or replace function public.confirm_appointment_by_token(p_token uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_status public.appointment_status;
begin
    select status into v_status from appointments where reschedule_token = p_token;
    if not found then raise exception 'invalid_token' using errcode = '22023'; end if;
    if v_status <> 'pending' then return false; end if;
    update appointments set status = 'confirmed' where reschedule_token = p_token;
    return true;
end $$;

revoke execute on function public.confirm_appointment_by_token(uuid) from public, anon;
grant execute on function public.confirm_appointment_by_token(uuid) to authenticated, anon;
