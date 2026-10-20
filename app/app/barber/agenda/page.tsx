'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CalendarBlank,
  Check,
  Clock,
  Receipt,
  Timer,
  UserMinus,
  X,
} from '@phosphor-icons/react';
import AppShell, { EmptyState } from '@/components/app/AppShell';
import { Skeleton, StatusBadge, brl } from '@/components/app/ui';
import ComandaSheet from '@/components/barber/ComandaSheet';
import {
  blockMyTime,
  fetchDayAppointments,
  fetchMyProfessional,
  setAppointmentStatus,
} from '@/lib/api/barber';
import { dateKey } from '@/lib/booking/format';
import type { Appointment, Professional } from '@/lib/api/types';

const DAY_LABEL = (d: Date) =>
  d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });

export default function BarberAgendaPage() {
  const [pro, setPro] = useState<Professional | null>(null);
  const [loadingPro, setLoadingPro] = useState(true);
  const [date, setDate] = useState(() => new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [comanda, setComanda] = useState<Appointment | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setPro(await fetchMyProfessional());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Falha ao carregar o profissional.');
      } finally {
        setLoadingPro(false);
      }
    })();
  }, []);

  const range = useMemo(() => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end, key: dateKey(date) };
  }, [date]);

  const load = useCallback(async () => {
    if (!pro) return;
    setLoading(true);
    try {
      setAppointments(
        await fetchDayAppointments(pro.org_id, pro.id, range.start.toISOString(), range.end.toISOString())
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar a agenda.');
    } finally {
      setLoading(false);
    }
  }, [pro, range.start, range.end]);

  useEffect(() => {
    load();
  }, [load]);

  const shiftDay = (delta: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + delta);
    setDate(next);
  };

  const stats = useMemo(() => {
    const done = appointments.filter((a) => a.status === 'completed');
    return {
      total: appointments.length,
      done: done.length,
      revenue: done.reduce((sum, a) => sum + Number(a.service_price), 0),
    };
  }, [appointments]);

  const today = dateKey(new Date()) === range.key;

  return (
    <AppShell
      title="Minha agenda"
      subtitle={pro ? pro.full_name : loadingPro ? 'Carregando…' : 'Profissional não vinculado'}
      action={
        <button
          onClick={() => setBlockOpen(true)}
          className="flex items-center gap-1.5 rounded-2xl border border-accent/30 bg-accent-soft px-3 py-2.5 text-[12.5px] font-semibold text-accent transition active:scale-95"
        >
          <Timer size={15} weight="duotone" /> Bloquear
        </button>
      }
    >
      <div className="space-y-4">
        {/* navegação de dia */}
        <div className="glass flex items-center justify-between px-3 py-2.5">
          <button
            onClick={() => shiftDay(-1)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-border text-secondary hover:text-primary"
            aria-label="Dia anterior"
          >
            <ArrowLeft size={16} weight="bold" />
          </button>
          <div className="text-center">
            <p className="text-[14px] font-semibold capitalize text-primary">{DAY_LABEL(date)}</p>
            <p className="text-[11.5px] text-muted">
              {today ? 'Hoje' : `${stats.total} agendamentos`}
            </p>
          </div>
          <button
            onClick={() => shiftDay(1)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-border text-secondary hover:text-primary"
            aria-label="Próximo dia"
          >
            <ArrowRight size={16} weight="bold" />
          </button>
        </div>

        {/* resumo do dia */}
        <div className="grid grid-cols-3 gap-3">
          <MiniStat label="Agendados" value={String(stats.total)} />
          <MiniStat label="Finalizados" value={String(stats.done)} />
          <MiniStat label="Produção" value={brl(stats.revenue)} gold />
        </div>

        {error && (
          <p className="rounded-2xl border border-critical/40 bg-critical/10 px-4 py-3 text-[13px] text-critical">
            {error}
          </p>
        )}

        {!loadingPro && !pro ? (
          <EmptyState
            icon={<UserMinus size={22} weight="duotone" />}
            title="Cadeira não vinculada"
            hint="Peça ao gestor para cadastrar o seu e-mail em Ajustes → Barbeiros. O vínculo é automático."
          />
        ) : loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <EmptyState
            icon={<CalendarBlank size={22} weight="duotone" />}
            title="Nenhum atendimento neste dia"
            hint="Aproveite para organizar a cadeira ou confirmar os próximos clientes."
          />
        ) : (
          <div className="space-y-3">
            {appointments.map((a, i) => (
              <motion.article
                key={a.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="glass p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-14 shrink-0 text-center">
                    <p className="text-[17px] font-semibold leading-none text-primary">
                      {new Date(a.start_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">{a.duration_min}min</p>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[15px] font-semibold text-primary">
                        {a.customer?.full_name ?? 'Cliente'}
                      </p>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="mt-0.5 truncate text-[12.5px] text-secondary">
                      {a.service_name} · {brl(a.service_price)}
                    </p>
                    {a.customer?.notes && (
                      <p className="mt-1 line-clamp-2 rounded-lg bg-accent-soft/60 px-2 py-1 text-[11.5px] text-accent">
                        {a.customer.notes}
                      </p>
                    )}
                  </div>
                </div>

                <AppointmentActions
                  appointment={a}
                  onChange={load}
                  onComanda={() => setComanda(a)}
                />
              </motion.article>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {comanda && pro && (
          <ComandaSheet
            appointment={comanda}
            orgId={pro.org_id}
            onClose={() => setComanda(null)}
            onClosed={() => {
              setComanda(null);
              load();
            }}
          />
        )}
        {blockOpen && pro && (
          <BlockSheet
            orgId={pro.org_id}
            onClose={() => setBlockOpen(false)}
            onBlocked={() => {
              setBlockOpen(false);
              load();
            }}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

/* ----------------------------- ações por status ---------------------------- */

function AppointmentActions({
  appointment,
  onChange,
  onComanda,
}: {
  appointment: Appointment;
  onChange: () => void;
  onComanda: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function move(status: Parameters<typeof setAppointmentStatus>[1]) {
    setBusy(true);
    try {
      await setAppointmentStatus(appointment.id, status);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  const s = appointment.status;

  // Finalizado/cancelado/no-show: sem ações.
  if (s === 'completed' || s === 'cancelled' || s === 'no_show') {
    return (
      <div className="mt-3 flex items-center gap-2 text-[12px] text-muted">
        <Receipt size={14} /> Comanda encerrada
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {(s === 'pending' || s === 'confirmed') && (
        <>
          <ActionButton busy={busy} tone="primary" onClick={() => move('in_progress')}>
            <Clock size={14} weight="duotone" /> Atender
          </ActionButton>
          <ActionButton busy={busy} tone="ghost" onClick={() => move('checked_in')}>
            <Check size={14} weight="bold" /> Chegou
          </ActionButton>
        </>
      )}

      {s === 'checked_in' && (
        <ActionButton busy={busy} tone="primary" onClick={() => move('in_progress')}>
          <Clock size={14} weight="duotone" /> Iniciar
        </ActionButton>
      )}

      <ActionButton busy={busy} tone={s === 'in_progress' ? 'primary' : 'ghost'} onClick={onComanda}>
        <Receipt size={14} weight="duotone" /> Comanda
      </ActionButton>

      <ActionButton busy={busy} tone="ghost" onClick={() => move('no_show')}>
        <X size={14} weight="bold" /> No-show
      </ActionButton>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  busy,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  tone: 'primary' | 'ghost';
}) {
  return (
    <button
      disabled={busy}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] font-semibold transition active:scale-95 disabled:opacity-50 ${
        tone === 'primary'
          ? 'border-accent/40 bg-accent-soft text-accent'
          : 'border-border bg-surface text-secondary hover:text-primary'
      }`}
    >
      {children}
    </button>
  );
}

/* --------------------------- bloqueio rápido de hora ----------------------- */

function BlockSheet({
  orgId,
  onClose,
  onBlocked,
}: {
  orgId: string;
  onClose: () => void;
  onBlocked: () => void;
}) {
  const [hours, setHours] = useState(1);
  const [reason, setReason] = useState('Intervalo');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBlock() {
    setBusy(true);
    setError(null);
    try {
      const start = new Date();
      const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
      await blockMyTime(start.toISOString(), end.toISOString(), reason);
      onBlocked();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível bloquear.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-6"
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong w-full max-w-md space-y-4 rounded-b-none p-5 sm:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[16px] font-semibold text-primary">
            <Timer size={18} weight="duotone" className="text-accent" /> Bloqueio rápido
          </h2>
          <button onClick={onClose} className="text-muted hover:text-primary" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <div>
          <span className="step-label">Duração a partir de agora</span>
          <div className="grid grid-cols-4 gap-2">
            {[0.5, 1, 2, 4].map((h) => (
              <button
                key={h}
                onClick={() => setHours(h)}
                className={`rounded-2xl border py-3 text-[13px] font-semibold transition ${
                  hours === h
                    ? 'border-accent/40 bg-accent-soft text-accent'
                    : 'border-border bg-surface text-secondary'
                }`}
              >
                {h < 1 ? '30min' : `${h}h`}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="step-label">Motivo</span>
          <input
            className="field"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Almoço, saída de emergência…"
          />
        </label>

        {error && (
          <p className="rounded-2xl border border-critical/40 bg-critical/10 px-4 py-3 text-[13px] text-critical">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button className="btn-glass" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={handleBlock} disabled={busy}>
            {busy ? 'Bloqueando…' : 'Bloquear horário'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function MiniStat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="glass px-3 py-3 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className={`mt-1 text-[16px] font-semibold ${gold ? 'text-accent' : 'text-primary'}`}>
        {value}
      </p>
    </div>
  );
}
