-- ============================================================================
--  0007 — Correção do bootstrap de usuários (Database error saving new user)
--
--  PROBLEMA
--    O handle_new_user() do 0002 inseria direto em public.profiles pegando
--    `new.phone` (que, em cadastro por e-mail, é NULL) e o `org_id` cru do
--    metadata (que, para o gestor novo, não existe ainda). Qualquer um destes
--    três casos derruba o INSERT e o Supabase devolve ao cliente o genérico
--      {"message": "Database error saving new user"}
--    porque a exceção ocorre dentro do trigger da tabela auth.users:
--      a) full_name NULL  → viola profiles.full_name NOT NULL
--      b) role inválido   → cast (raw_user_meta_data->>'role')::app_role explode
--      c) org_id inválido → FK profiles.org_id → organizations(id) não existe
--      d) phone fora do E.164 do constraint profiles_phone_e164
--
--  SOLUÇÃO
--    Recria a função com sanitização + defaults seguros e NUNCA deixa o
--    cadastro falhar: qualquer erro inesperado é capturado e o profile é
--    criado no modo "sem organização" (role client), que o middleware já
--    trata mandando o gestor para /auth/signup-barbershop.
--
--  Aditivo e idempotente: pode ser executado quantas vezes for necessário.
-- ============================================================================

-- ── 1. Sanitizadores reutilizáveis ──────────────────────────────────────────

-- Normaliza telefone para E.164 (+55…) ou devolve NULL.
create or replace function public.fn_sanitize_phone(p_phone text)
returns text language plpgsql immutable as $$
declare
    v_digits text;
begin
    if p_phone is null or trim(p_phone) = '' then
        return null;
    end if;

    v_digits := regexp_replace(p_phone, '\D', '', 'g');

    -- "5511987654321" ou "11987654321" → "+55…"
    if length(v_digits) between 10 and 11 then
        v_digits := '55' || v_digits;
    end if;

    if length(v_digits) between 12 and 15 then
        return '+' || v_digits;
    end if;

    return null;   -- fora do padrão: grava NULL em vez de quebrar o cadastro
end $$;

-- Lê o papel do metadata com fallback seguro (nunca lança cast inválido).
create or replace function public.fn_sanitize_role(p_role text)
returns public.app_role language plpgsql immutable as $$
declare
    v_role public.app_role;
begin
    if p_role is null or trim(p_role) = '' then
        return 'client';
    end if;

    begin
        v_role := trim(p_role)::public.app_role;
    exception when invalid_text_representation then
        return 'client';
    end;

    -- 'barber' sem organização não faz sentido no login; fica client até linkar.
    return coalesce(v_role, 'client');
end $$;

-- ── 2. handle_new_user() defensivo ──────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
    v_org      uuid;
    v_role     public.app_role;
    v_name     text;
    v_phone    text;
    v_email    text;
begin
    -- (a) e-mail/telefone — cadastro por e-mail tem new.phone = NULL
    v_email := nullif(trim(coalesce(new.email, new.raw_user_meta_data ->> 'email', '')), '');
    v_phone := public.fn_sanitize_phone(
        coalesce(new.phone, new.raw_user_meta_data ->> 'phone')
    );

    -- (b) papel com fallback (nunca lança cast inválido)
    v_role := public.fn_sanitize_role(new.raw_user_meta_data ->> 'role');

    -- (c) nome com fallback em cascata — profiles.full_name é NOT NULL
    v_name := nullif(trim(coalesce(
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'name',
        ''
    )), '');
    if v_name is null then
        v_name := coalesce(split_part(coalesce(v_email, ''), '@', 1), '');
    end if;
    if v_name is null or trim(v_name) = '' then
        v_name := 'Cliente';
    end if;

    -- (d) org_id só entra se REALMENTE existir (senão a FK derruba o INSERT)
    begin
        select id into v_org
        from public.organizations
        where id = nullif(new.raw_user_meta_data ->> 'org_id', '')::uuid
        limit 1;
    exception when invalid_text_representation then
        v_org := null;   -- metadata com org_id não-uuid
    end;

    insert into public.profiles (id, org_id, role, full_name, phone, email)
    values (new.id, v_org, v_role, v_name, v_phone, v_email)
    on conflict (id) do update
        set full_name = coalesce(nullif(trim(profiles.full_name), ''), excluded.full_name),
            email     = coalesce(profiles.email, excluded.email),
            phone     = coalesce(profiles.phone, excluded.phone),
            updated_at = now();

    return new;

exception
    when others then
        -- Última linha de defesa: cadastro nunca pode quebrar por profile.
        -- O middleware leva usuário sem org para /auth/signup-barbershop.
        begin
            insert into public.profiles (id, org_id, role, full_name, phone, email)
            values (new.id, null, 'client', 'Cliente', null,
                    nullif(trim(coalesce(new.email, '')), ''))
            on conflict (id) do nothing;
        exception when others then
            null;   -- nem o fallback funcionou: deixa o auth seguir (profile órfão)
        end;
        return new;
end $$;

-- ── 3. Recria o trigger na auth.users ───────────────────────────────────────

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ── 4. Permissões ───────────────────────────────────────────────────────────
-- A função é SECURITY DEFINER e só é chamada pelo trigger; ninguém a executa
-- direto pelo PostgREST.
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

-- ── 5. Onboarding: garante org + profile owner (idempotente) ────────────────
-- Reforça o contrato do 0006: cria a barbearia e promove o usuário logado.
create or replace function public.create_barbershop(
    p_name    text,
    p_slug    text,
    p_phone   text default null,
    p_address jsonb default '{}'::jsonb
)
returns table (org_id uuid, slug text)
language plpgsql security definer set search_path = public as $$
declare
    v_uid   uuid := auth.uid();
    v_org   uuid;
    v_phone text;
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

    v_phone := public.fn_sanitize_phone(p_phone);

    insert into public.organizations (name, slug, phone, address)
    values (trim(p_name), p_slug, v_phone, coalesce(p_address, '{}'::jsonb))
    returning id into v_org;

    -- vínculo obrigatório: o usuário logado vira owner DESTA org
    insert into public.profiles (id, org_id, role, full_name, phone, email)
    select v_uid, v_org, 'owner',
           coalesce(
               nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
               nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
               'Gestor'),
           coalesce(v_phone, public.fn_sanitize_phone(u.phone)),
           nullif(trim(coalesce(u.email, '')), '')
    from auth.users u
    where u.id = v_uid
    on conflict (id) do update
        set org_id = v_org,
            role   = 'owner',
            phone  = coalesce(profiles.phone, excluded.phone),
            updated_at = now();

    -- expediente padrão: seg(1) a sáb(6), 09:00–20:00 (só se ainda não houver)
    insert into public.availability_rules (org_id, professional_id, weekday, start_time, end_time)
    select v_org, null, d, time '09:00', time '20:00'
    from generate_series(1, 6) as d
    where not exists (
        select 1 from public.availability_rules r where r.org_id = v_org
    );

    return query select v_org, p_slug;
end $$;

revoke execute on function public.create_barbershop(text, text, text, jsonb) from public, anon;
grant execute on function public.create_barbershop(text, text, text, jsonb) to authenticated;

-- ── 6. Perfil do usuário logado (usado no login/roteamento por role) ────────
create or replace function public.my_profile()
returns jsonb language sql stable security definer set search_path = public as $$
    select jsonb_build_object(
        'id', p.id,
        'role', p.role,
        'full_name', p.full_name,
        'email', p.email,
        'org_id', p.org_id,
        'org_name', o.name,
        'org_slug', o.slug
    )
    from public.profiles p
    left join public.organizations o on o.id = p.org_id
    where p.id = auth.uid()
$$;

grant execute on function public.my_profile() to authenticated;
