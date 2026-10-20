'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Confetti,
  Gift,
  Scissors,
  Sparkle,
  Ticket,
} from '@phosphor-icons/react';
import AppShell, { EmptyState } from '@/components/app/AppShell';
import { Skeleton, brl, pct } from '@/components/app/ui';
import { fetchLoyalty, fetchMyOrganization, redeemLoyalty } from '@/lib/api/client';
import type { LoyaltyStatus, Organization } from '@/lib/api/types';

export default function ClientLoyaltyPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [redeemedCode, setRedeemedCode] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const organization = await fetchMyOrganization();
        setOrg(organization);
        if (organization) {
          const status = (await fetchLoyalty(organization.id)) as LoyaltyStatus;
          setLoyalty(status);
          if (status.available) setCelebrating(true);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Falha ao carregar a fidelidade.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleRedeem() {
    if (!org || !loyalty) return;
    try {
      const code = await redeemLoyalty(org.id);
      setRedeemedCode(code);
      setLoyalty({ ...loyalty, available: false, progress: 0, rewards: loyalty.rewards + 1, code: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível resgatar agora.');
    }
  }

  const target = loyalty?.target ?? 10;
  const progress = loyalty?.progress ?? 0;
  const filled = Math.min(progress, target);
  const percent = pct(filled, target);

  return (
    <AppShell
      title="Cartão fidelidade"
      subtitle={org ? `A cada ${target} cortes, um é por nossa conta` : 'Carregando…'}
    >
      <div className="space-y-5">
        {error && (
          <p className="rounded-2xl border border-critical/40 bg-critical/10 px-4 py-3 text-[13px] text-critical">
            {error}
          </p>
        )}

        {loading ? (
          <Skeleton className="h-72" />
        ) : !org || !loyalty || !loyalty.linked ? (
          <EmptyState
            icon={<Gift size={22} weight="duotone" />}
            title="Programa de fidelidade"
            hint="Faça seu primeiro atendimento para começar a carimbar o cartão e ganhar um corte grátis."
            action={
              <Link href="/b/demo" className="btn-primary !w-auto px-6">
                Agendar agora
              </Link>
            }
          />
        ) : (
          <>
            {/* ── cartão com carimbos ─────────────────────────────────────── */}
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 240, damping: 26 }}
              className="ticket-shine relative overflow-hidden rounded-3xl border border-accent/25 p-6"
              style={{ background: 'var(--grad-gold)' }}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-accent-contrast/80">
                    Cartão fidelidade
                  </span>
                  <Sparkle size={18} weight="fill" className="text-accent-contrast/70" />
                </div>

                <p className="mt-1 text-[30px] font-bold leading-none text-accent-contrast">
                  {filled}
                  <span className="text-[18px] font-semibold opacity-70">/{target}</span>
                </p>
                <p className="mt-1 text-[13px] font-medium text-accent-contrast/80">
                  {filled >= target
                    ? 'Cartão completo — resgate o seu corte grátis!'
                    : `Faltam ${target - filled} corte${target - filled > 1 ? 's' : ''} para o seu brinde`}
                </p>

                {/* carimbos */}
                <div className="mt-4 grid grid-cols-5 gap-2">
                  {Array.from({ length: target }).map((_, i) => {
                    const stamped = i < filled;
                    return (
                      <motion.span
                        key={i}
                        initial={{ scale: stamped ? 0.6 : 1, opacity: stamped ? 0 : 1 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: stamped ? i * 0.06 : 0, type: 'spring', stiffness: 320 }}
                        className={`grid aspect-square place-items-center rounded-full border-2 ${
                          stamped
                            ? 'border-accent-contrast/40 bg-accent-contrast/90 text-accent'
                            : 'border-accent-contrast/30 text-accent-contrast/40'
                        }`}
                      >
                        {stamped ? (
                          <Scissors size={14} weight="bold" />
                        ) : (
                          <span className="text-[11px] font-bold">{i + 1}</span>
                        )}
                      </motion.span>
                    );
                  })}
                </div>
              </div>

              <div className="ticket-notch -left-3 top-1/2 -translate-y-1/2" />
              <div className="ticket-notch -right-3 top-1/2 -translate-y-1/2" />
            </motion.section>

            {/* ── barra de progresso ──────────────────────────────────────── */}
            <div className="glass p-4">
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-secondary">Progresso até o brinde</span>
                <span className="font-semibold text-accent">{percent}%</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 24 }}
                  className="h-full rounded-full"
                  style={{ background: 'var(--grad-gold)' }}
                />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                <MiniInfo label="Visitas" value={String(loyalty.visits)} />
                <MiniInfo label="Brindes" value={String(loyalty.rewards)} />
                <MiniInfo label="Pontos" value={String(loyalty.points)} />
              </div>
              {loyalty.first_visit_at && (
                <p className="mt-3 text-center text-[11.5px] text-muted">
                  Cliente desde{' '}
                  {new Date(loyalty.first_visit_at).toLocaleDateString('pt-BR', {
                    month: 'long',
                    year: 'numeric',
                  })}{' '}
                  · {brl(loyalty.total_spent)} investidos em você
                </p>
              )}
            </div>

            {/* ── cupom ──────────────────────────────────────────────────── */}
            <AnimatePresence>
              {(loyalty.available || redeemedCode) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 240, damping: 22 }}
                  className="glass-strong relative overflow-hidden border-positive/30 p-5 text-center"
                >
                  <motion.span
                    animate={{ rotate: [0, -8, 8, -8, 0], scale: [1, 1.06, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.4 }}
                    className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-positive/40 bg-positive/10 text-positive"
                  >
                    <Confetti size={30} weight="duotone" />
                  </motion.span>

                  <p className="mt-3 text-[18px] font-bold text-primary">
                    Parabéns! Corte grátis liberado 🎉
                  </p>
                  <p className="mt-1 text-[13px] text-secondary">
                    Apresente este cupom na barbearia para resgatar o seu atendimento por nossa conta.
                  </p>

                  {(redeemedCode || loyalty.code) && (
                    <div className="mt-4 rounded-2xl border border-dashed border-accent/40 bg-accent-soft px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                        Código do cupom
                      </p>
                      <p className="mt-1 font-mono text-[17px] font-bold tracking-widest text-accent">
                        {redeemedCode ?? loyalty.code}
                      </p>
                    </div>
                  )}

                  {redeemedCode ? (
                    <p className="mt-3 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-positive">
                      <Ticket size={15} weight="duotone" /> Cupom reservado — mostre na recepção
                    </p>
                  ) : (
                    <button onClick={handleRedeem} className="btn-primary mt-4">
                      <Gift size={18} weight="duotone" /> Resgatar meu corte grátis
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <p className="pb-2 text-center text-[11.5px] text-muted">
              Os carimbos são contados automaticamente a cada pagamento registrado na barbearia.
            </p>
          </>
        )}
      </div>

      {/* confete discreto ao abrir com brinde disponível */}
      <AnimatePresence>
        {celebrating && loyalty?.available && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onAnimationComplete={() => setCelebrating(false)}
            className="pointer-events-none fixed inset-0 z-30"
          >
            {Array.from({ length: 14 }).map((_, i) => (
              <motion.span
                key={i}
                initial={{ y: -20, x: `${(i / 14) * 100}%`, opacity: 1 }}
                animate={{ y: '110vh', rotate: i * 40, opacity: 0 }}
                transition={{ duration: 2.4 + (i % 5) * 0.3, delay: (i % 7) * 0.12, ease: 'easeIn' }}
                className="absolute h-2.5 w-2.5 rounded-sm"
                style={{ background: i % 2 ? 'var(--accent)' : 'var(--positive)' }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold text-primary">{value}</p>
    </div>
  );
}
