'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import { CloudSun, Moon, Sun, TrendUp } from '@phosphor-icons/react';
import { dateFromKey, dateKey, timeOf } from '@/lib/booking/format';
import type { Slot } from '@/lib/booking/types';

export type DayInfo = {
  key: string; // 'yyyy-mm-dd'
  weekday: string; // 'seg'
  day: number; // 23
  month: string; // 'out'
};

type Props = {
  days: DayInfo[];
  date: string;
  onDateChange: (key: string) => void;
  slots: Slot[];
  selectedSlot: Slot | null;
  onSelectSlot: (slot: Slot) => void;
  loading: boolean;
  /** Escassez real: total de vagas no dia (vem da agenda já carregada). */
  dayTotals?: Record<string, number>;
};

type Turno = 'all' | 'morning' | 'afternoon' | 'evening';

const TURNO_META: { key: Turno; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: 'Todos', icon: <TrendUp size={13} weight="bold" /> },
  { key: 'morning', label: 'Manhã', icon: <Sun size={13} weight="bold" /> },
  { key: 'afternoon', label: 'Tarde', icon: <CloudSun size={13} weight="bold" /> },
  { key: 'evening', label: 'Noite', icon: <Moon size={13} weight="bold" /> },
];

const turnoOf = (iso: string): Exclude<Turno, 'all'> => {
  const h = new Date(iso).getHours();
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
};

const list: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03 } },
};
const pill: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.94 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 380, damping: 26 } },
};

/**
 * Tela 2 — agenda viva:
 *  · carrossel de 14 dias arrastável (arraste o dedo/mouse, snap por dia)
 *  · marcadores "hoje/amanhã/fds" + badge dourado de escassez
 *  · filtro de turnos instantâneo (client-side, zero requisição)
 *  · pill dourado animado (layoutId) no horário selecionado
 */
export function DateTimePicker({
  days,
  date,
  onDateChange,
  slots,
  selectedSlot,
  onSelectSlot,
  loading,
  dayTotals = {},
}: Props) {
  const [turno, setTurno] = useState<Turno>('all');
  const stripRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, startX: 0, scrollLeft: 0, moved: false });
  const el0 = () => stripRef.current;

  // centraliza o dia selecionado no carrossel
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const btn = el.querySelector<HTMLElement>(`[data-day="${date}"]`);
    btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [date]);

  // arrastar com o mouse (touch usa o scroll nativo)
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    drag.current = { down: true, startX: e.clientX, scrollLeft: el0()?.scrollLeft ?? 0, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const el = el0();
    if (!el || !drag.current.down) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    el.scrollLeft = drag.current.scrollLeft - dx;
  };
  const endDrag = () => {
    drag.current.down = false;
  };

  const pickDay = (key: string) => {
    if (drag.current.moved) return; // foi arraste, não clique
    onDateChange(key);
    setTurno('all');
  };

  const today = dateKey(new Date());
  const tomorrow = dateKey(new Date(Date.now() + 864e5));
  const visible = slots.filter((s) => turno === 'all' || turnoOf(s.start) === turno);
  const totalToday = dayTotals[today];
  const scarcity =
    totalToday !== undefined && totalToday > 0 && totalToday <= 8 && date === today;

  return (
    <div className="space-y-6">
      {/* ---------------------------- carrossel ---------------------------- */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <span className="step-label mb-0">3 · Dia</span>
          <span className="text-[11px] text-muted">arraste →</span>
        </div>
        <div
          ref={stripRef}
          className="hide-scrollbar flex cursor-grab gap-2.5 overflow-x-auto pb-2 active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {days.map((d, i) => {
            const isActive = d.key === date;
            const dow = dateFromKey(d.key).getDay();
            const isWeekend = dow === 0 || dow === 6;
            const total = dayTotals[d.key];
            const isTight = total !== undefined && total > 0 && total <= 8;
            return (
              <button
                key={d.key}
                type="button"
                data-day={d.key}
                aria-pressed={isActive}
                onClick={() => pickDay(d.key)}
                className="relative flex w-[68px] shrink-0 flex-col items-center gap-0.5 rounded-2xl border py-2.5 transition active:scale-[0.96]"
                style={{
                  scrollSnapAlign: i < 3 ? 'start' : 'center',
                  background: isActive ? 'var(--grad-gold)' : 'var(--bg-surface)',
                  borderColor: isActive ? 'transparent' : 'var(--border-default)',
                  color: isActive ? 'var(--accent-contrast)' : 'var(--text-secondary)',
                  boxShadow: isActive ? 'var(--shadow-gold)' : 'var(--shadow-card)',
                  backdropFilter: 'var(--glass-blur)',
                  WebkitBackdropFilter: 'var(--glass-blur)',
                }}
              >
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: isActive ? 'var(--accent-contrast)' : 'var(--text-muted)' }}
                >
                  {d.weekday}
                </span>
                <span className="font-mono text-lg font-bold leading-none">{d.day}</span>
                <span
                  className="text-[9px] font-semibold uppercase"
                  style={{ color: isActive ? 'var(--accent-contrast)' : isWeekend ? 'var(--accent)' : 'var(--text-muted)' }}
                >
                  {d.key === today
                    ? 'hoje'
                    : d.key === tomorrow
                      ? 'amanhã'
                      : isWeekend
                        ? d.month
                        : '\u00A0'}
                </span>
                {isTight && !isActive && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-warning" />
                )}
              </button>
            );
          })}
        </div>

        {scarcity && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="badge-gold mt-2"
          >
            <TrendUp size={11} weight="bold" />
            Poucos horários restantes para hoje — {totalToday} vagas
          </motion.p>
        )}
      </section>

      {/* -------------------------- filtro de turnos -------------------------- */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <span className="step-label mb-0">4 · Horário</span>
          <div className="flex gap-1 rounded-full border p-1" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}>
            {TURNO_META.map((t) => (
              <button
                key={t.key}
                type="button"
                aria-pressed={turno === t.key}
                onClick={() => setTurno(t.key)}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition active:scale-95"
                style={{
                  background: turno === t.key ? 'var(--accent-soft)' : 'transparent',
                  color: turno === t.key ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2.5" aria-label="Carregando horários">
            <div className="skeleton h-4 w-24" />
            <div className="grid grid-cols-3 gap-2.5">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="skeleton h-[48px]" style={{ animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
          </div>
        ) : slots.length === 0 ? (
          <div className="glass anim-fade-up flex flex-col items-center gap-2 px-5 py-9 text-center">
            <p className="text-sm font-semibold text-primary">Nenhum horário livre neste dia</p>
            <p className="text-xs text-muted">
              A casa está cheia ou fechada. Toque em outro dia no carrossel acima.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <div className="glass anim-fade-up flex flex-col items-center gap-2 px-5 py-8 text-center">
            <p className="text-sm font-semibold text-primary">Sem horários nesse turno</p>
            <button
              type="button"
              className="text-xs font-semibold text-accent"
              onClick={() => setTurno('all')}
            >
              Ver todos os horários do dia →
            </button>
          </div>
        ) : (
          <motion.div
            key={`${date}-${turno}`}
            className="space-y-5"
            variants={list}
            initial="hidden"
            animate="show"
          >
            {(['morning', 'afternoon', 'evening'] as const)
              .filter((t) => turno === 'all' || turno === t)
              .map((t) => {
                const items = visible.filter((s) => turnoOf(s.start) === t);
                if (items.length === 0) return null;
                return (
                  <div key={t}>
                    <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                      {TURNO_META.find((x) => x.key === t)?.icon}
                      {TURNO_META.find((x) => x.key === t)?.label}
                      <span className="font-mono font-normal">· {items.length} livres</span>
                    </p>
                    <div className="grid grid-cols-3 gap-2.5">
                      {items.map((slot) => {
                        const isActive = selectedSlot?.start === slot.start;
                        return (
                          <motion.button
                            key={slot.start}
                            type="button"
                            variants={pill}
                            whileTap={{ scale: 0.92 }}
                            aria-pressed={isActive}
                            onClick={() => onSelectSlot(slot)}
                            className="relative rounded-xl border py-3 font-mono text-sm font-medium transition"
                            style={{
                              background: isActive ? 'var(--grad-gold)' : 'var(--bg-surface)',
                              borderColor: isActive ? 'transparent' : 'var(--border-default)',
                              color: isActive ? 'var(--accent-contrast)' : 'var(--text-primary)',
                              boxShadow: isActive ? 'var(--shadow-gold)' : 'none',
                              backdropFilter: 'var(--glass-blur)',
                              WebkitBackdropFilter: 'var(--glass-blur)',
                            }}
                          >
                            {isActive && (
                              <motion.span
                                layoutId="slot-glow"
                                className="pointer-events-none absolute -inset-0.5 rounded-xl border-2 border-accent"
                                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                              />
                            )}
                            {timeOf(slot.start)}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </motion.div>
        )}
      </section>
    </div>
  );
}

/** 14 dias a partir de hoje, no fuso do aparelho. */
export function buildDays(count: number): DayInfo[] {
  const out: DayInfo[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    out.push({
      key: dateKey(d),
      weekday: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').slice(0, 3),
      day: d.getDate(),
      month: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
    });
  }
  return out;
}
