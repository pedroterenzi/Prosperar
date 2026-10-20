'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle, Spinner } from '@phosphor-icons/react';
import { brl, formatPhoneDigits, onlyDigits } from '@/lib/booking/format';
import type { Service } from '@/lib/booking/types';

type Props = {
  service: Service;
  professionalLabel: string;
  dateLabel: string;
  timeLabel: string;

  name: string;
  onName: (v: string) => void;
  phoneDigits: string;
  onPhoneDigits: (v: string) => void;

  sessionPhone: string | null;
  otpSent: boolean;
  otpCode: string;
  onOtpCode: (v: string) => void;

  sendingOtp: boolean;
  verifyingOtp: boolean;
  booking: boolean;
  formError: string | null;

  onSendOtp: () => void;
  onVerifyOtp: (code: string) => void;
  onConfirm: () => void;
  onBack: () => void;
};

/**
 * Tela 3 — bottom sheet de confirmação com glassmorphism.
 * Com sessão ativa o fluxo vira 1 toque (só "Confirmar agendamento").
 */
export function ConfirmSheet({
  service,
  professionalLabel,
  dateLabel,
  timeLabel,
  name,
  onName,
  phoneDigits,
  onPhoneDigits,
  sessionPhone,
  otpSent,
  otpCode,
  onOtpCode,
  sendingOtp,
  verifyingOtp,
  booking,
  formError,
  onSendOtp,
  onVerifyOtp,
  onConfirm,
  onBack,
}: Props) {
  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="-ml-1 flex items-center gap-1.5 text-sm font-medium text-secondary transition hover:text-primary"
      >
        <ArrowLeft size={16} /> Voltar e escolher horário
      </button>

      {/* Resumo — cartão de vidro */}
      <motion.div
        className="glass-strong relative overflow-hidden p-6"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 -top-16 h-32 opacity-60"
          style={{ background: 'radial-gradient(60% 100% at 50% 100%, var(--accent-soft), transparent)' }}
        />
        <p className="text-[17px] font-bold leading-tight text-primary">{service.name}</p>
        <p className="mt-1 text-sm text-secondary">{professionalLabel}</p>
        <div className="my-4 h-px" style={{ background: 'var(--border-default)' }} />
        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-2xl font-bold text-primary">{timeLabel}</p>
            <p className="mt-0.5 text-xs text-muted">{dateLabel}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-xl font-bold text-positive">{brl(service.price)}</p>
            <p className="mt-0.5 text-xs text-muted">{service.duration_min} min</p>
          </div>
        </div>
      </motion.div>

      {!sessionPhone ? (
        <div className="space-y-4">
          <div>
            <label htmlFor="bf-name" className="step-label mb-1.5">
              Seu nome
            </label>
            <input
              id="bf-name"
              className="field"
              placeholder="Como te chamamos?"
              value={name}
              autoComplete="name"
              onChange={(e) => onName(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="bf-phone" className="step-label mb-1.5">
              WhatsApp
            </label>
            <div className="flex items-center gap-2">
              <span
                className="flex h-[50px] shrink-0 items-center rounded-2xl border px-3.5 font-mono text-[15px] text-secondary"
                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
              >
                +55
              </span>
              <input
                id="bf-phone"
                className="field font-mono"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="(11) 98765-4321"
                value={formatPhoneDigits(phoneDigits)}
                onChange={(e) => onPhoneDigits(onlyDigits(e.target.value).slice(0, 11))}
              />
            </div>
          </div>

          {!otpSent ? (
            <button
              type="button"
              className="btn-glass"
              disabled={sendingOtp || phoneDigits.length < 10}
              onClick={onSendOtp}
            >
              {sendingOtp && <Spinner size={16} className="animate-spin" />}
              Receber código no WhatsApp
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <p className="text-xs text-muted">
                Código de 6 dígitos enviado para{' '}
                <span className="font-mono text-secondary">{formatPhoneDigits(phoneDigits)}</span>.
              </p>
              <input
                id="bf-otp"
                className="field text-center font-mono text-2xl tracking-[0.6em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="······"
                aria-label="Código de verificação"
                value={otpCode}
                onChange={(e) => {
                  const code = onlyDigits(e.target.value).slice(0, 6);
                  onOtpCode(code);
                  if (code.length === 6) onVerifyOtp(code); // auto-submit
                }}
              />
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  className="font-semibold text-accent disabled:opacity-40"
                  disabled={verifyingOtp || sendingOtp}
                  onClick={onSendOtp}
                >
                  Reenviar código
                </button>
                {verifyingOtp && (
                  <span className="flex items-center gap-1.5 text-muted">
                    <Spinner size={13} className="animate-spin" /> Verificando…
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass flex items-center gap-2.5 px-5 py-4"
        >
          <CheckCircle size={20} weight="fill" className="shrink-0 text-positive" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary">
              {name?.trim() || 'Cliente verificado'}
            </p>
            <p className="truncate font-mono text-xs text-muted">{sessionPhone}</p>
          </div>
        </motion.div>
      )}

      {formError && (
        <motion.p
          role="alert"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'color-mix(in srgb, var(--critical) 40%, transparent)',
            background: 'color-mix(in srgb, var(--critical) 10%, transparent)',
            color: 'var(--critical)',
          }}
        >
          {formError}
        </motion.p>
      )}

      <div className="space-y-3">
        <button
          type="button"
          className="btn-primary"
          disabled={!sessionPhone || booking}
          onClick={onConfirm}
        >
          {booking && <Spinner size={16} className="animate-spin" />}
          Confirmar agendamento
        </button>
        <p className="text-center text-[11px] leading-relaxed text-muted">
          Ao confirmar você aceita os termos de uso e a política de privacidade. Cancelamentos:
          avise com pelo menos 2h de antecedência pelo WhatsApp.
        </p>
      </div>
    </div>
  );
}
