'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Phone, Spinner, TrendUp } from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase/client';
import {
  bookAppointment,
  fetchCatalog,
  fetchMyAppointments,
  fetchOrgBySlug,
  fetchSlotsFor,
  sendOtp,
  verifyOtp,
} from '@/lib/booking/api';
import { dateKey, dateLabelLong, onlyDigits, timeOf, toE164 } from '@/lib/booking/format';
import type { MyAppointment, Org, Service, Slot } from '@/lib/booking/types';
import { ConfirmSheet } from './ConfirmSheet';
import { DateTimePicker, buildDays } from './DateTimePicker';
import { ServicePicker } from './ServicePicker';
import { TicketPass } from './TicketPass';

type Phase = 'loading' | 'error' | 'service' | 'slot' | 'confirm' | 'done';

const DAYS_AHEAD = 14;
const days = buildDays(DAYS_AHEAD);

/** Transição deslizante/fade padrão entre etapas. */
const stepMotion = {
  initial: { opacity: 0, x: 32 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -32 },
  transition: { type: 'spring' as const, stiffness: 320, damping: 30 },
};

/**
 * Fluxo Zero Friction — 3 toques (docs/02-ux-flows.md).
 * A agenda dos próximos 14 dias é pré-carregada em paralelo: trocar de dia é
 * instantâneo e os badges de escassez são reais (vagas contadas por dia).
 */
export default function BookingFlow({
  slug,
  initialServiceId = null,
}: {
  slug: string;
  /** "Repetir agendamento": pula direto para a escolha do profissional. */
  initialServiceId?: string | null;
}) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [org, setOrg] = useState<Org | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [professionalId, setProfessionalId] = useState('any');
  const [date, setDate] = useState(() => dateKey(new Date()));
  const [slot, setSlot] = useState<Slot | null>(null);

  // agenda pré-carregada: { 'yyyy-mm-dd': Slot[] }
  const [agenda, setAgenda] = useState<Record<string, Slot[]> | null>(null);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Identidade por OTP (sem senha)
  const [name, setName] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [sessionPhone, setSessionPhone] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [booking, setBooking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [done, setDone] = useState<{ token: string; start: string } | null>(null);
  const [mine, setMine] = useState<MyAppointment[]>([]);
  const [mineOpen, setMineOpen] = useState(false);

  const service = useMemo(
    () => services.find((s) => s.id === serviceId) ?? null,
    [services, serviceId]
  );
  const professionalLabel = useMemo(() => {
    if (!service) return '';
    if (professionalId === 'any') return 'Qualquer profissional';
    return service.professionals.find((p) => p.id === professionalId)?.name ?? '';
  }, [service, professionalId]);

  /* ----------------------------- carga inicial ---------------------------- */

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const o = await fetchOrgBySlug(slug);
        if (!alive) return;
        if (!o) throw new Error('org_not_found');
        setOrg(o);
        const svc = await fetchCatalog(o.id);
        if (!alive) return;
        if (svc.length === 0) throw new Error('empty_catalog');
        setServices(svc);

        // Repetir agendamento: pré-seleciona o serviço e vai direto aos horários.
        const preselected = initialServiceId
          ? svc.find((s) => s.id === initialServiceId) ?? null
          : null;
        if (preselected) {
          setServiceId(preselected.id);
          setPhase('slot');
        } else {
          setPhase('service');
        }
      } catch {
        if (alive) setPhase('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug, initialServiceId]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const phone = data.session?.user?.phone ?? null;
      if (phone) {
        setSessionPhone(phone);
        setPhoneDigits(onlyDigits(phone));
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionPhone(session?.user?.phone ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /* --------------------- agenda: 14 dias em paralelo ---------------------- */

  const loadAgenda = useCallback(async () => {
    if (!org || !service) return;
    setAgendaLoading(true);
    setAgenda(null);
    try {
      const professionals =
        professionalId === 'any'
          ? service.professionals
          : service.professionals.filter((p) => p.id === professionalId);
      const entries = await Promise.all(
        days.map(async (d): Promise<[string, Slot[]]> => {
          try {
            const slots = await fetchSlotsFor({
              orgId: org.id,
              professionals,
              durationMin: service.duration_min,
              date: d.key,
            });
            return [d.key, slots];
          } catch {
            return [d.key, []];
          }
        })
      );
      setAgenda(Object.fromEntries(entries));
    } finally {
      setAgendaLoading(false);
    }
  }, [org, service, professionalId]);

  useEffect(() => {
    if (phase === 'slot') loadAgenda();
  }, [phase, loadAgenda]);

  const slots = agenda?.[date] ?? [];
  const dayTotals = useMemo(() => {
    if (!agenda) return {};
    return Object.fromEntries(Object.entries(agenda).map(([k, v]) => [k, v.length]));
  }, [agenda]);

  /* ------------------------------ identidade ------------------------------ */

  const handleSendOtp = async () => {
    if (!org) return;
    if (phoneDigits.length < 10) {
      setFormError('Informe um celular válido com DDD.');
      return;
    }
    setSendingOtp(true);
    setFormError(null);
    try {
      await sendOtp(toE164(phoneDigits), org.id, name);
      setOtpSent(true);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Não foi possível enviar o código.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (code: string) => {
    setVerifyingOtp(true);
    setFormError(null);
    try {
      const phone = toE164(phoneDigits);
      await verifyOtp(phone, code);
      setSessionPhone(phone);
      setOtpCode('');
    } catch {
      setFormError('Código incorreto ou expirado. Confira o WhatsApp.');
      setOtpCode('');
    } finally {
      setVerifyingOtp(false);
    }
  };

  /* ------------------------------ confirmação ----------------------------- */

  const handleConfirm = async () => {
    if (!org || !service || !slot || !sessionPhone) return;
    setBooking(true);
    setFormError(null);
    try {
      const res = await bookAppointment({
        orgId: org.id,
        serviceId: service.id,
        professionalId: slot.professional_id,
        startAt: slot.start,
        phone: sessionPhone,
        fullName: name.trim() || undefined,
      });
      setDone({ token: res.token, start: slot.start });
      setPhase('done');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'error';
      if (msg.includes('slot_unavailable')) {
        setNotice('Esse horário acabou de ser ocupado. Escolha outro.');
        setSlot(null);
        setPhase('slot');
        loadAgenda(); // agenda já atualizada com a corrida resolvida no banco
      } else if (msg.includes('auth_required')) {
        setFormError('Confirme o código do WhatsApp antes de agendar.');
      } else {
        setFormError('Não foi possível agendar. Tente novamente.');
      }
    } finally {
      setBooking(false);
    }
  };

  const loadMine = useCallback(async () => {
    if (!org) return;
    try {
      setMine(await fetchMyAppointments(org.id));
    } catch {
      setMine([]);
    }
  }, [org]);

  useEffect(() => {
    if (phase === 'done') loadMine();
  }, [phase, loadMine]);

  const resetFlow = () => {
    setSlot(null);
    setDone(null);
    setOtpSent(false);
    setOtpCode('');
    setFormError(null);
    setNotice(null);
    setPhase('service');
  };

  /* -------------------------------- render -------------------------------- */

  const stepIndex = phase === 'service' ? 0 : phase === 'slot' ? 1 : 2;
  const doneService = done
    ? services.find((s) => s.id === serviceId) ?? null
    : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 pb-2 pt-6">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
          style={{ background: 'var(--grad-gold)', color: 'var(--accent-contrast)', boxShadow: 'var(--shadow-gold)' }}
        >
          {org?.name?.[0] ?? 'P'}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-primary">{org?.name ?? '…'}</p>
          <p className="text-xs text-muted">Agendamento online · 3 toques</p>
        </div>
        {org?.phone && (
          <a
            href={`tel:${org.phone}`}
            aria-label="Ligar para a barbearia"
            className="glass ml-auto flex h-11 w-11 items-center justify-center rounded-2xl text-secondary transition active:scale-95"
          >
            <Phone size={17} />
          </a>
        )}
      </header>

      {/* Progresso 1 · 2 · 3 */}
      {phase !== 'done' && phase !== 'loading' && phase !== 'error' && (
        <div className="flex items-center gap-2 px-5 pb-5 pt-2" aria-label="Progresso do fluxo">
          {[0, 1, 2].map((i) => (
            <Fragment key={i}>
              <motion.span
                animate={{
                  width: i <= stepIndex ? 34 : 16,
                  backgroundColor:
                    i <= stepIndex ? 'var(--accent)' : 'var(--border-default)',
                }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="h-1.5 rounded-full"
              />
              <span className="sr-only">Etapa {i + 1}</span>
            </Fragment>
          ))}
        </div>
      )}

      {/* Aviso inline (sem alert()/confirm()) */}
      <AnimatePresence>
        {notice && phase !== 'done' && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="overflow-hidden px-5"
          >
            <div
              className="mb-4 rounded-2xl border px-4 py-3 text-sm"
              style={{
                borderColor: 'color-mix(in srgb, var(--warning) 40%, transparent)',
                background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
                color: 'var(--warning)',
              }}
            >
              {notice}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === 'loading' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 pb-24 text-muted">
          <Spinner size={28} className="animate-spin" />
          <p className="text-sm">Carregando a casa…</p>
        </div>
      )}

      {phase === 'error' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 pb-24 text-center">
          <div className="glass flex h-16 w-16 items-center justify-center rounded-3xl">
            <TrendUp size={28} className="text-muted" />
          </div>
          <div>
            <p className="font-semibold text-primary">Não encontramos essa barbearia</p>
            <p className="mt-1 text-sm text-muted">
              Confira o link ou fale com o estúdio. (slug: {slug})
            </p>
          </div>
          <button type="button" className="btn-glass w-auto px-6" onClick={() => location.reload()}>
            Tentar de novo
          </button>
        </div>
      )}

      {/* Transições deslizantes entre etapas */}
      <AnimatePresence mode="wait" initial={false}>
        {phase === 'service' && services.length > 0 && (
          <motion.section key="service" {...stepMotion} className="flex-1 px-5 pb-44">
            <ServicePicker
              services={services}
              selectedServiceId={serviceId}
              selectedProfessionalId={professionalId}
              onSelectService={(id) => {
                setServiceId(id);
                setNotice(null);
              }}
              onSelectProfessional={setProfessionalId}
            />
          </motion.section>
        )}

        {phase === 'slot' && (
          <motion.section key="slot" {...stepMotion} className="flex-1 px-5 pb-44">
            <button
              type="button"
              onClick={() => setPhase('service')}
              className="-ml-1 mb-5 flex items-center gap-1.5 text-sm font-medium text-secondary transition hover:text-primary"
            >
              <ArrowLeft size={16} /> Serviço
            </button>
            <p className="mb-5 text-sm text-secondary">
              {service?.name} · <span className="text-muted">{professionalLabel}</span>
            </p>
            <DateTimePicker
              days={days}
              date={date}
              onDateChange={(d) => {
                setDate(d);
                setSlot(null);
                setNotice(null);
              }}
              slots={slots}
              selectedSlot={slot}
              onSelectSlot={setSlot}
              loading={agendaLoading}
              dayTotals={dayTotals}
            />
          </motion.section>
        )}

        {phase === 'confirm' && service && (
          <motion.section key="confirm" {...stepMotion} className="flex-1 px-5 pb-12">
            <ConfirmSheet
              service={service}
              professionalLabel={
                slot
                  ? service.professionals.find((p) => p.id === slot.professional_id)?.name ??
                    professionalLabel
                  : professionalLabel
              }
              dateLabel={dateLabelLong(date)}
              timeLabel={slot ? timeOf(slot.start) : ''}
              name={name}
              onName={setName}
              phoneDigits={phoneDigits}
              onPhoneDigits={(v) => {
                setPhoneDigits(v);
                setFormError(null);
              }}
              sessionPhone={sessionPhone}
              otpSent={otpSent}
              otpCode={otpCode}
              onOtpCode={setOtpCode}
              sendingOtp={sendingOtp}
              verifyingOtp={verifyingOtp}
              booking={booking}
              formError={formError}
              onSendOtp={handleSendOtp}
              onVerifyOtp={handleVerifyOtp}
              onConfirm={handleConfirm}
              onBack={() => setPhase('slot')}
            />
          </motion.section>
        )}

        {phase === 'done' && done && org && (
          <motion.section key="done" {...stepMotion} className="flex-1 space-y-5 px-5 pb-12">
            <TicketPass
              orgName={org.name}
              orgPhone={org.phone}
              serviceName={doneService?.name ?? 'Agendamento'}
              professionalLabel={
                doneService?.professionals.find((p) => p.id === slot?.professional_id)?.name ??
                professionalLabel
              }
              startIso={done.start}
              durationMin={doneService?.duration_min ?? 30}
              price={doneService?.price ?? 0}
              token={done.token}
              onScheduleAnother={resetFlow}
            />

            {/* Minhas reservas — SELECT direto em appointments (RLS: só as suas) */}
            <div className="glass overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between px-5 py-4 text-left"
                onClick={() => {
                  setMineOpen((v) => !v);
                  if (!mineOpen && mine.length === 0) loadMine();
                }}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <TrendUp size={16} /> Minhas próximas reservas
                </span>
                <span className="font-mono text-xs text-muted">{mine.length}</span>
              </button>
              <AnimatePresence>
                {mineOpen && mine.length > 0 && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    {mine.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center justify-between gap-3 border-b px-5 py-3 last:border-0"
                        style={{ borderColor: 'var(--border-subtle)' }}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-primary">{m.service_name}</p>
                          <p className="truncate text-xs text-muted">{m.pro_name ?? 'Profissional'}</p>
                        </div>
                        <span className="shrink-0 text-right">
                          <span className="block font-mono text-sm text-primary">
                            {timeOf(m.start_at)}
                          </span>
                          <span className="block text-[11px] text-muted">
                            {dateLabelLong(dateKey(new Date(m.start_at)))}
                          </span>
                        </span>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Barra fixa com o CTA principal (fora do AnimatePresence p/ crossfade) */}
      <FooterBar>
        <AnimatePresence mode="wait" initial={false}>
          {phase === 'service' && (
            <motion.div
              key="cta-service"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <button
                type="button"
                className="btn-primary"
                disabled={!service}
                onClick={() => setPhase('slot')}
              >
                Continuar <ArrowRight size={18} weight="bold" />
              </button>
            </motion.div>
          )}
          {phase === 'slot' && (
            <motion.div
              key="cta-slot"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <button
                type="button"
                className="btn-primary"
                disabled={!slot}
                onClick={() => setPhase('confirm')}
              >
                {slot ? (
                  <>
                    Confirmar {timeOf(slot.start)} <ArrowRight size={18} weight="bold" />
                  </>
                ) : (
                  'Escolha um horário'
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </FooterBar>
    </main>
  );
}

/** Barra flutuante inferior (vidro + blur) com o botão principal. */
function FooterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0">
      <div className="mx-auto w-full max-w-md px-5 pb-6 pt-8">
        <div
          className="pointer-events-auto rounded-3xl border p-3"
          style={{
            borderColor: 'var(--border-default)',
            background: 'color-mix(in srgb, var(--bg-base) 72%, transparent)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
