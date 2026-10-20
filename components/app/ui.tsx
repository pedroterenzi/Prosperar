'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { AppointmentStatus } from '@/lib/api/types';

/* --------------------------------- dinheiro -------------------------------- */

const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const brl = (v: number | string | null | undefined) => brlFormatter.format(Number(v ?? 0));

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.min(100, Math.round((part / whole) * 100));
}

/* --------------------------------- cartões --------------------------------- */

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  icon,
  index = 0,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'positive' | 'negative' | 'gold';
  icon?: ReactNode;
  index?: number;
}) {
  const valueClass =
    tone === 'positive'
      ? 'text-positive'
      : tone === 'negative'
        ? 'text-critical'
        : tone === 'gold'
          ? 'text-accent'
          : 'text-primary';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 260, damping: 26 }}
      className="glass p-4"
    >
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.1em]">{label}</span>
      </div>
      <p className={`mt-2 text-[22px] font-semibold leading-none ${valueClass}`}>{value}</p>
      {hint && <p className="mt-1.5 text-[12px] text-secondary">{hint}</p>}
    </motion.div>
  );
}

/* ---------------------------------- barras --------------------------------- */

/** Gráfico de barras em SVG puro — sem dependência externa. */
export function BarChart({
  data,
  height = 140,
  format = (v: number) => String(v),
}: {
  data: { label: string; value: number; highlight?: boolean }[];
  height?: number;
  format?: (v: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d, i) => {
        const h = Math.max((d.value / max) * 100, d.value > 0 ? 4 : 1.5);
        return (
          <div key={`${d.label}-${i}`} className="group flex flex-1 flex-col items-center gap-1.5">
            <span className="text-[10px] font-semibold text-muted opacity-0 transition group-hover:opacity-100">
              {format(d.value)}
            </span>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ delay: i * 0.03, type: 'spring', stiffness: 220, damping: 26 }}
              className={`w-full rounded-t-lg ${
                d.highlight ? 'bg-accent' : 'bg-accent-soft border border-accent/25'
              }`}
              style={{ minHeight: 3 }}
            />
            <span className={`text-[10.5px] ${d.highlight ? 'font-semibold text-accent' : 'text-muted'}`}>
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------- status --------------------------------- */

const STATUS_META: Record<AppointmentStatus, { label: string; className: string }> = {
  pending: { label: 'Aguardando', className: 'border-warning/40 bg-warning/10 text-warning' },
  confirmed: { label: 'Confirmado', className: 'border-info/40 bg-info/10 text-info' },
  checked_in: { label: 'Chegou', className: 'border-accent/40 bg-accent-soft text-accent' },
  in_progress: { label: 'Em atendimento', className: 'border-accent/50 bg-accent-soft text-accent' },
  completed: { label: 'Finalizado', className: 'border-positive/40 bg-positive/10 text-positive' },
  cancelled: { label: 'Cancelado', className: 'border-border bg-surface text-muted' },
  no_show: { label: 'No-show', className: 'border-critical/40 bg-critical/10 text-critical' },
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.confirmed;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

export const STATUS_LABEL = STATUS_META;

/* --------------------------------- diversos -------------------------------- */

export function PageSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="step-label !mb-0">{title}</h3>
      {children}
    </section>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-2xl border border-border p-1 text-[13px] font-semibold">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-xl px-3 py-2 transition ${
            value === o.value ? 'bg-accent text-accent-contrast' : 'text-secondary'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Spinner_Dot({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" />
      {label}
    </div>
  );
}

export function Skeleton({ className = 'h-32' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}
