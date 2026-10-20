'use client';

import { motion } from 'framer-motion';
import { CalendarPlus, DownloadSimple, WhatsappLogo } from '@phosphor-icons/react';
import { brl, dateLabelLong, timeOf } from '@/lib/booking/format';
import { buildIcs, downloadIcs, googleCalendarUrl } from '@/lib/booking/calendar';

type Props = {
  orgName: string;
  orgPhone: string | null;
  serviceName: string;
  professionalLabel: string;
  startIso: string;
  durationMin: number;
  price: number;
  token: string; // reschedule_token (usado como UID do .ics)
  onScheduleAnother: () => void;
};

/**
 * Comprovante interativo estilo "ticket/pass": cabeçalho dourado com carimbo
 * AGENDADO, corpo com rasgo, e ações — Google Agenda, .ics e WhatsApp com
 * comprovante pré-preenchido.
 */
export function TicketPass({
  orgName,
  orgPhone,
  serviceName,
  professionalLabel,
  startIso,
  durationMin,
  price,
  token,
  onScheduleAnother,
}: Props) {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + durationMin * 60_000);
  const dateLabel = dateLabelLong(`${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`);
  const timeLabel = timeOf(startIso);

  const details =
    `${serviceName} com ${professionalLabel} na ${orgName}. ` +
    `Reserva #${token.slice(0, 8).toUpperCase()}. Cancelamento: avise com 2h de antecedência.`;
  const calEvent = {
    uid: token,
    title: `${serviceName} — ${orgName}`,
    details,
    location: orgName,
    startIso,
    endIso: end.toISOString(),
  };
  const waText =
    `Comprovante de agendamento — ${orgName}\n` +
    `Serviço: ${serviceName} (${durationMin} min)\n` +
    `Profissional: ${professionalLabel}\n` +
    `Data: ${dateLabel} às ${timeLabel}\n` +
    `Valor: ${brl(price)}\n` +
    `Código da reserva: #${token.slice(0, 8).toUpperCase()}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotate: -1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      className="glass-strong relative overflow-hidden"
    >
      {/* Cabeçalho dourado com carimbo */}
      <div
        className="ticket-shine relative px-6 pb-7 pt-6 text-center"
        style={{ background: 'var(--grad-gold)', color: 'var(--accent-contrast)' }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] opacity-80">
          {orgName}
        </p>
        <p className="mt-1 text-2xl font-extrabold">Agendado!</p>
        <motion.span
          initial={{ scale: 2.4, opacity: 0, rotate: -22 }}
          animate={{ scale: 1, opacity: 1, rotate: -8 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.35 }}
          className="absolute right-4 top-4 rounded-md border-2 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest"
          style={{ borderColor: 'var(--accent-contrast)', opacity: 0.85 }}
        >
          Confirmado
        </motion.span>
      </div>

      {/* Corpo do ticket */}
      <div className="relative px-6 pb-5 pt-6">
        {/* rasgo (perforação) com entalhes laterais */}
        <div
          className="absolute inset-x-0 top-0 border-t-2 border-dashed"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <span className="ticket-notch -left-3 -top-3" />
          <span className="ticket-notch -right-3 -top-3" />
        </div>

        <p className="text-lg font-bold leading-tight text-primary">{serviceName}</p>
        <p className="mt-0.5 text-sm text-secondary">{professionalLabel}</p>

        <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl border py-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
            <dt className="text-[10px] uppercase tracking-wider text-muted">Data</dt>
            <dd className="mt-0.5 font-mono text-sm font-semibold text-primary">
              {start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </dd>
          </div>
          <div className="rounded-xl border py-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
            <dt className="text-[10px] uppercase tracking-wider text-muted">Hora</dt>
            <dd className="mt-0.5 font-mono text-sm font-semibold text-primary">{timeLabel}</dd>
          </div>
          <div className="rounded-xl border py-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
            <dt className="text-[10px] uppercase tracking-wider text-muted">Valor</dt>
            <dd className="mt-0.5 font-mono text-sm font-semibold text-positive">{brl(price)}</dd>
          </div>
        </dl>

        <p className="mt-4 text-center font-mono text-[11px] text-muted">
          Reserva #{token.slice(0, 8).toUpperCase()} · {dateLabel}
        </p>
      </div>

      {/* Ações do comprovante */}
      <div className="space-y-2.5 border-t px-6 py-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <a
          className="btn-primary"
          target="_blank"
          rel="noopener noreferrer"
          href={googleCalendarUrl(calEvent)}
        >
          <CalendarPlus size={17} weight="bold" /> Adicionar ao Google Agenda
        </a>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            className="btn-glass"
            onClick={() => downloadIcs(`agendamento-${token.slice(0, 8)}.ics`, buildIcs(calEvent))}
          >
            <DownloadSimple size={16} /> .ics
          </button>
          <a
            className="btn-glass"
            target="_blank"
            rel="noopener noreferrer"
            href={`https://wa.me/${(orgPhone ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(waText)}`}
          >
            <WhatsappLogo size={16} weight="fill" /> Comprovante
          </a>
        </div>
        <button type="button" className="btn-glass mt-1" onClick={onScheduleAnother}>
          Agendar outro
        </button>
      </div>
    </motion.div>
  );
}
