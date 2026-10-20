'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowsClockwise, HandCoins, PiggyBank, Scissors, TrendDown, TrendUp } from '@phosphor-icons/react';
import AppShell, { EmptyState } from '@/components/app/AppShell';
import { BarChart, PageSection, Segmented, Skeleton, StatCard, brl } from '@/components/app/ui';
import { fetchBarberSummary, fetchMyProfessional } from '@/lib/api/barber';
import { dateKey } from '@/lib/booking/format';
import type { BarberSummary, Professional } from '@/lib/api/types';

type Period = '7d' | '30d' | 'mtd';
const WEEK_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function periodRange(period: Period) {
  const today = new Date();
  if (period === 'mtd') {
    return {
      from: dateKey(new Date(today.getFullYear(), today.getMonth(), 1)),
      to: dateKey(today),
    };
  }
  const start = new Date(today);
  start.setDate(start.getDate() - (period === '7d' ? 6 : 29));
  return { from: dateKey(start), to: dateKey(today) };
}

export default function BarberDashboardPage() {
  const [pro, setPro] = useState<Professional | null>(null);
  const [period, setPeriod] = useState<Period>('mtd');
  const [data, setData] = useState<BarberSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => periodRange(period), [period]);

  useEffect(() => {
    (async () => {
      try {
        setPro(await fetchMyProfessional());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Falha ao carregar o profissional.');
      }
    })();
  }, []);

  const load = useCallback(async () => {
    if (!pro) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchBarberSummary(pro.id, range.from, range.to));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar os ganhos.');
    } finally {
      setLoading(false);
    }
  }, [pro, range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  const weekendBars = useMemo(() => {
    if (!data?.by_weekday) return WEEK_SHORT.map((label) => ({ label, value: 0 }));
    const byDow = new Map(data.by_weekday.map((w) => [w.dow, w.qty]));
    // ordem de exibição: seg → dom (mais natural na barbearia)
    const order = [1, 2, 3, 4, 5, 6, 0];
    const max = Math.max(...order.map((d) => byDow.get(d) ?? 0), 1);
    return order.map((d) => ({
      label: WEEK_SHORT[d],
      value: byDow.get(d) ?? 0,
      highlight: (byDow.get(d) ?? 0) === max && max > 0,
    }));
  }, [data]);

  const dailyBars = useMemo(() => {
    if (!data?.daily) return [];
    return data.daily.map((d) => ({
      label: d.day.slice(8, 10) + '/' + d.day.slice(5, 7),
      value: Number(d.commission) + Number(d.tips),
    }));
  }, [data]);

  const total = data ? Number(data.commission) + Number(data.tips) : 0;

  return (
    <AppShell
      title="Meus ganhos"
      subtitle={pro ? pro.full_name : loading ? 'Carregando…' : 'Profissional não vinculado'}
      action={
        <button
          onClick={load}
          aria-label="Atualizar"
          className="grid h-10 w-10 place-items-center rounded-2xl border border-border bg-surface text-muted transition hover:text-primary"
        >
          <ArrowsClockwise size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      }
    >
      <div className="space-y-5">
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
            {error}
          </p>
        )}

        {!pro && !loading ? (
          <EmptyState
            icon={<Scissors size={22} weight="duotone" />}
            title="Cadeira não vinculada"
            hint="Peça ao gestor para cadastrar o seu e-mail em Ajustes → Barbeiros."
          />
        ) : loading || !data ? (
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
                label="A receber"
                value={brl(total)}
                hint="Comissões + gorjetas"
                tone="gold"
                icon={<HandCoins size={16} weight="duotone" />}
              />
              <StatCard
                index={1}
                label="Comissões"
                value={brl(data.commission)}
                hint={`Pendente: ${brl(data.pending)}`}
                tone="positive"
                icon={<PiggyBank size={16} weight="duotone" />}
              />
              <StatCard
                index={2}
                label="Gorjetas"
                value={brl(data.tips)}
                hint="100% do profissional"
                icon={<TrendUp size={16} weight="duotone" />}
              />
              <StatCard
                index={3}
                label="Cortes realizados"
                value={String(data.cuts)}
                hint={`Produção: ${brl(data.sold)}`}
                icon={<Scissors size={16} weight="duotone" />}
              />
            </div>

            {data.no_shows > 0 && (
              <p className="flex items-center gap-2 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-warning">
                <TrendDown size={16} weight="duotone" />
                {data.no_shows} no-show{data.no_shows > 1 ? 's' : ''} no período — avise a recepção
                para confirmar antes.
              </p>
            )}

            <PageSection title="Dias mais movimentados">
              <div className="glass p-4">
                <BarChart data={weekendBars} format={(v) => `${v} cortes`} />
              </div>
            </PageSection>

            <PageSection title="Extrato diário (comissão + gorjeta)">
              <div className="glass p-4">
                {dailyBars.length ? (
                  <BarChart data={dailyBars} format={(v) => brl(v)} />
                ) : (
                  <p className="py-8 text-center text-[13px] text-muted">
                    Nenhum recebimento registrado no período.
                  </p>
                )}
              </div>
            </PageSection>

            <PageSection title="Fechamento">
              <div className="glass divide-y divide-border">
                <RowLine label="Produção bruta (serviços)" value={brl(data.sold)} />
                <RowLine label="Comissão acumulada" value={brl(data.commission)} />
                <RowLine label="Gorjetas" value={brl(data.tips)} />
                <RowLine
                  label="Pendente de repasse"
                  value={brl(data.pending)}
                  strong
                  tone="gold"
                />
              </div>
            </PageSection>
          </>
        )}
      </div>
    </AppShell>
  );
}

function RowLine({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'gold';
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className={`text-[13.5px] ${strong ? 'font-semibold text-primary' : 'text-secondary'}`}>
        {label}
      </span>
      <span
        className={`text-[15px] ${strong ? 'font-semibold' : ''} ${
          tone === 'gold' ? 'text-accent' : 'text-primary'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
