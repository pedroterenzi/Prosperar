-- ============================================================================
--  0004 — Seed de demonstração para o app (/b/demo)
--  Org + catálogo + cadeiras + expediente (Seg–Sáb 09h–20h, almoço 12h–13h)
-- ============================================================================

insert into public.organizations (name, slug, phone, timezone)
values ('Prosperar Club', 'demo', '+5511999990000', 'America/Sao_Paulo')
on conflict (slug) do nothing;

-- Cadeiras
insert into public.professionals (org_id, full_name, phone, pix_key, color, sort_order)
select o.id, p.name, p.phone, p.pix, p.color, p.ord
from (values
    ('José Silva',    '+5511988880001', 'jose@pix.com',    '#C9A227', 1),
    ('Mike Torres',   '+5511988880002', 'mike@pix.com',    '#60A5FA', 2),
    ('Rafa Almeida',  '+5511988880003', 'rafa@pix.com',    '#34D399', 3)
) as p(name, phone, pix, color, ord)
cross join public.organizations o
where o.slug = 'demo'
on conflict do nothing;

-- Catálogo (duração é dado, não texto)
insert into public.services (org_id, name, description, duration_min, price, commission_pct, sort_order)
select o.id, s.name, s.descr, s.dur, s.price, s.comm, s.ord
from (values
    ('Corte Simples',      'Máquina e tesoura, finalização',      30, 40.00, 40, 1),
    ('Corte + Sobrancelha', 'Corte com acabamento de sobrancelha', 45, 55.00, 40, 2),
    ('Barba Completa',     'Toalha quente e navalha',             30, 35.00, 40, 3),
    ('Combo Premium',      'Corte + Barba + Sobrancelha',         60, 85.00, 45, 4)
) as s(name, descr, dur, price, comm, ord)
cross join public.organizations o
where o.slug = 'demo'
on conflict do nothing;

-- Expediente: Seg–Sáb 09:00–20:00 (0=Dom … 6=Sáb)
insert into public.availability_rules (org_id, professional_id, weekday, start_time, end_time)
select o.id, p.id, d.dow, time '09:00', time '20:00'
from public.organizations o
cross join generate_series(1, 6) as d(dow)          -- seg a sáb
cross join public.professionals p
where o.slug = 'demo' and p.org_id = o.id
on conflict do nothing;

-- Almoço 12:00–13:00 como time_off diário por cadeira (bloqueia toda a janela)
insert into public.time_off (org_id, professional_id, starts_at, ends_at, all_day, reason)
select o.id, p.id,
       (d.day::timestamp + interval '12 hours') at time zone 'America/Sao_Paulo',
       (d.day::timestamp + interval '13 hours') at time zone 'America/Sao_Paulo',
       false, 'Almoço'
from public.organizations o
cross join public.professionals p
cross join generate_series(current_date, current_date + interval '90 days', interval '1 day') as d(day)
where o.slug = 'demo' and p.org_id = o.id
  and extract(dow from d.day) between 1 and 6
on conflict do nothing;

-- Feriado de exemplo (bloqueia a casa toda)
insert into public.time_off (org_id, professional_id, starts_at, ends_at, all_day, reason)
select o.id, null, (current_date + 30)::timestamp at time zone 'America/Sao_Paulo',
       (current_date + 31)::timestamp at time zone 'America/Sao_Paulo', true, 'Feriado'
from public.organizations o
where o.slug = 'demo'
on conflict do nothing;
