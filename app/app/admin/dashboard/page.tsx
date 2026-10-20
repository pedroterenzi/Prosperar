'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowsClockwise,
  CashRegister,
  ChartLineUp,
  Clock,
  Percent,
  Scissors,
  Storefront,
} from '@phosphor-icons/react';
import AppShell from '@/components/app/AppShell';
import {
  BarChart,
  PageSection,
  Segmented,
  Skeleton,
  StatCard,
  brl,
} from '@/components/app/ui';
import { fetchAdminSummary, fetchOrganization } from '@/lib/api/admin';
import { dateKey } from '@/lib/booking/format';
import type { AdminSummary, Organization } from '@/lib/api/types';

type Period = '7d' | '30d' | 'mtd';

/** Intervalo [from, to] em 'yyyy-mm-dd' no fuso do aparelho. */
function periodRange(period: Period): { from: string; to: string; label: string } {
  const today = new Date();
  if (period === 'mtd') {
    return {
      from: dateKey(new Date(today.getFullYear(), today.getMonth(), 1)),
      to: dateKey(today),
      label: 'Mês atual',
    };
  }
  const days = period === '7d' ? 6 : 29;
  const start = new Date(today);
  start.setDate(start.getDate() - days);
  return { from: dateKey(start), to: dateKey(today), label: period === '7d' ? '7 dias' : '30 dias' };
}

export default function AdminDashboardPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [period, setPeriod] = useState<Period>('mtd');
  const [data, setData] = useState<AdminSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => periodRange(period), [period]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Descobre a org do usuário uma única vez (RLS responde só a própria).
      let currentOrg = org;
      if (!currentOrg) {
        const {
          data: { user },
        } = await (await import('@/lib/supabase/client')).supabase.auth.getUser();
        if (!user) return;
        const { supabase } = await import('@/lib/supabase/client');
        const { data: profile } = await supabase
          .from('profiles')
          .select('org_id')
          .eq('id', user.id)
          .maybeSingle();
        if (!profile?.org_id) return;
        currentOrg = await fetchOrganization(profile.org_id);
        setOrg(currentOrg);
      }
      if (!currentOrg) return;

      setData(await fetchAdminSummary(currentOrg.id, range.from, range.to));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar o resumo.');
    } finally {
      setLoading(false);
    }
  }, [org, range.from, range.to]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const confirmed = data?.appointments?.confirmed ?? 0;
  const completed = data?.appointments?.completed ?? 0;
  const noShow = data?.appointments?.no_show ?? 0;
  const totalAppts = Object.values(data?.appointments ?? {}).reduce((a, b) => a + b, 0);
  const absentRate = totalAppts ? Math.round((noShow / totalAppts) * 100) : 0;

  const dayBars = useMemo(() => {
    if (!data?.by_day) return [];
    return data.by_day.map((d) => ({
      label: d.day.slice(8, 10) + '/' + d.day.slice(5, 7),
      value: Number(d.gross),
    }));
  }, [data]);

  const occupancyBars = useMemo(() => {
    if (!data?.occupancy) return [];
    // ocupação = minutos ocupados / (cadeiras × 10h de expediente)
    return data.occupancy.map((d) => ({
      label: d.day.slice(8, 10) + '/' + d.day.slice(5, 7),
      value: d.chairs > 0 ? Math.round((d.busy_min / (d.chairs * 600)) * 100) : 0,
    }));
  }, [data]);

  return (
    <AppShell
      title="Visão geral do negócio"
      subtitle={org ? `${org.name} · ${range.label}` : 'Carregando…'}
      action={
        <button
          onClick={load}
          aria-label="Atualizar"
          className="grid h-10 w-10 place-items-center rounded-2xl border border-border bg-surface text-muted transition hover:text-primary"
        >
          <ArrowsClockwise size={18} weight={loading ? 'bold' : 'regular'} className={loading ? 'animate-spin' : ''} />
        </button>
      }
    >
      <div className="space-y-6">
        <Segmented
          value={period}
          onChange={setPeriod}
          options={[
            { value: '7d', label: '7 dias' },
            { value: '30d', label: '30 dias' },
            { value: 'mtd', label: 'Mês atual' },
          ]}
        />

        {error && (
          <p className="rounded-2xl border border-critical/40 bg-critical/10 px-4 py-3 text-[13px] text-critical">
            {error} — confirme se a migration 0006 foi aplicada no Supabase.
          </p>
        )}

        {loading || !data ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                index={0}
                label="Faturamento bruto"
                value={brl(data.gross)}
                hint={`Taxas: ${brl(data.fee)}`}
                tone="gold"
                icon={<CashRegister size={16} weight="duotone" />}
              />
              <StatCard
                index={1}
                label="Líquido recebido"
                value={brl(data.net)}
                hint={`Gorjetas: ${brl(data.tips)}`}
                tone="positive"
                icon={<ChartLineUp size={16} weight="duotone" />}
              />
              <StatCard
                index={2}
                label="Repasses do período"
                value={brl(data.commissions)}
                hint={`A pagar: ${brl(data.commissions_pending)}`}
                icon={<Percent size={16} weight="duotone" />}
              />
              <StatCard
                index={3}
                label="Resultado da casa"
                value={brl(data.result)}
                hint="Bruto − taxas − comissões"
                tone={data.result >= 0 ? 'positive' : 'negative'}
                icon={<Storefront size={16} weight="duotone" />}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Confirmados" value={String(confirmed)} />
              <MiniStat label="Finalizados" value={String(completed)} />
              <MiniStat label="No-show" value={`${noShow} · ${absentRate}%`} tone="critical" />
            </div>

            <PageSection title="Faturamento por dia">
              <div className="glass p-4">
                {dayBars.length ? (
                  <BarChart data={dayBars} format={(v) => brl(v)} />
                ) : (
                  <p className="py-8 text-center text-[13px] text-muted">
                    Sem vendas registradas nesse período.
                  </p>
                )}
              </div>
            </PageSection>

            <PageSection title="Ocupação das cadeiras (%)">
              <div className="glass p-4">
                {occupancyBars.length ? (
                  <BarChart data={occupancyBars} format={(v) => `${v}%`} />
                ) : (
                  <p className="py-8 text-center text-[13px] text-muted">
                    Ajuste o expediente em Ajustes → Expediente.
                  </p>
                )}
              </div>
            </PageSection>

            <PageSection title="Serviços mais vendidos">
              <div className="glass divide-y divide-border">
                {data.by_service.length === 0 && (
                  <p className="px-4 py-6 text-center text-[13px] text-muted">
                    Nenhum atendimento finalizado no período.
                  </p>
                )}
                {data.by_service.slice(0, 6).map((s, i) => (
                  <motion.div
                    key={s.name}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                        <Scissors size={15} weight="duotone" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-primary">{s.name}</p>
                        <p className="text-[12px] text-muted">{s.qty} atendimentos</p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[14px] font-semibold text-accent">{brl(s.amount)}</span>
                  </motion.div>
                ))}
              </div>
            </PageSection>

            <PageSection title="Desempenho da equipe">
              <div className="glass divide-y divide-border">
                {data.by_professional.length === 0 && (
                  <p className="px-4 py-6 text-center text-[13px] text-muted">
                    Cadastre a equipe em Ajustes → Barbeiros.
                  </p>
                )}
                {data.by_professional.map((p) => (
                  <div key={p.name} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className="h-9 w-1.5 shrink-0 rounded-full"
                      style={{ background: p.color ?? 'var(--accent)' }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-primary">{p.name}</p>
                      <p className="text-[12px] text-muted">
                        {p.cuts} cortes · comissão {brl(p.commission)} · gorjetas {brl(p.tips)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[14px] font-semibold text-primary">{brl(p.amount)}</span>
                  </div>
                ))}
              </div>
            </PageSection>

            <p className="flex items-center gap-2 pb-2 text-[12px] text-muted">
              <Clock size={14} /> Números calculados direto no banco (RPC admin_summary).
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'critical';
}) {
  return (
    <div className="glass px-3 py-3 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className={`mt-1 text-[16px] font-semibold ${tone === 'critical' ? 'text-critical' : 'text-primary'}`}>
        {value}
      </p>
    </div>
  );
}
