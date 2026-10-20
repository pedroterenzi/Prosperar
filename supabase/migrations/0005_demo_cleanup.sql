-- =====================================================================
--  0005 — Limpeza do seed demo (0004 colado 3x no SQL Editor)
--  Remove serviços e profissionais duplicados da org 'demo',
--  mantendo o registro mais antigo de cada nome.
-- =====================================================================

-- 1) Serviços duplicados (mantém o mais antigo por nome)
with demo as (select id from public.organizations where slug = 'demo'),
     dups as (
        select id,
               row_number() over (
                   partition by lower(trim(name))
                   order by created_at, sort_order
               ) as rn
        from public.services
        where org_id in (select id from demo)
     )
delete from public.services
where id in (select id from dups where rn > 1);

-- 2) Profissionais duplicados (mantém o mais antigo por nome;
--    availability_rules/time_off referenciados são removidos em cascata)
with demo as (select id from public.organizations where slug = 'demo'),
     dups as (
        select id,
               row_number() over (
                   partition by lower(trim(full_name))
                   order by created_at, sort_order
               ) as rn
        from public.professionals
        where org_id in (select id from demo)
     )
delete from public.professionals
where id in (select id from dups where rn > 1);

-- 3) Zera sort_order para ficar previsível
update public.services s set sort_order = x.rn
from (select id, row_number() over (partition by org_id order by sort_order, created_at) rn
      from public.services) x
where s.id = x.id and s.org_id in (select id from public.organizations where slug = 'demo');

update public.professionals p set sort_order = x.rn
from (select id, row_number() over (partition by org_id order by sort_order, created_at) rn
      from public.professionals) x
where p.id = x.id and p.org_id in (select id from public.organizations where slug = 'demo');

-- Conferência esperada: 4 serviços e 3 profissionais
select 'services' as tabela, count(*) as total from public.services s
  join public.organizations o on o.id = s.org_id where o.slug = 'demo'
union all
select 'professionals', count(*) from public.professionals p
  join public.organizations o on o.id = p.org_id where o.slug = 'demo';
