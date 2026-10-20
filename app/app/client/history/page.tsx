'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowClockwise,
  CalendarBlank,
  ImageSquare,
  NotePencil,
  Scissors,
} from '@phosphor-icons/react';
import AppShell, { EmptyState } from '@/components/app/AppShell';
import { Skeleton, brl } from '@/components/app/ui';
import { fetchMyHistory, fetchMyOrganization } from '@/lib/api/client';
import type { ClientHistoryItem, Organization } from '@/lib/api/types';

export default function ClientHistoryPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [history, setHistory] = useState<ClientHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const organization = await fetchMyOrganization();
        setOrg(organization);
        if (organization) setHistory(await fetchMyHistory(organization.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Falha ao carregar o histórico.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalSpent = history.reduce((sum, h) => sum + Number(h.service_price), 0);

  return (
    <AppShell
      title="Meus cortes"
      subtitle={org ? org.name : loading ? 'Carregando…' : undefined}
    >
      <div className="space-y-5">
        {error && (
          <p className="rounded-2xl border border-critical/40 bg-critical/10 px-4 py-3 text-[13px] text-critical">
            {error}
          </p>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : !org ? (
          <EmptyState
            icon={<Scissors size={22} weight="duotone" />}
            title="Você ainda não tem barbearia vinculada"
            hint="Faça um agendamento pelo link da sua barbearia para criar seu histórico."
            action={
              <Link href="/b/demo" className="btn-primary !w-auto px-6">
                Agendar agora
              </Link>
            }
          />
        ) : history.length === 0 ? (
          <EmptyState
            icon={<CalendarBlank size={22} weight="duotone" />}
            title="Nenhum corte registrado ainda"
            hint="Quando seu atendimento for finalizado, ele aparece aqui com as anotações do profissional."
            action={
              <Link href={`/b/${org.slug}`} className="btn-primary !w-auto px-6">
                Agendar meu primeiro corte
              </Link>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="glass p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Cortes realizados
                </p>
                <p className="mt-1.5 text-[22px] font-semibold text-primary">{history.length}</p>
              </div>
              <div className="glass p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Investido em você
                </p>
                <p className="mt-1.5 text-[22px] font-semibold text-accent">{brl(totalSpent)}</p>
              </div>
            </div>

            <div className="space-y-3">
              {history.map((h, i) => (
                <motion.article
                  key={h.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass overflow-hidden"
                >
                  <div className="flex items-start gap-3 p-4">
                    <div className="w-14 shrink-0 text-center">
                      <p className="text-[16px] font-semibold leading-none text-primary">
                        {new Date(h.start_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </p>
                      <p className="mt-1 text-[11px] capitalize text-muted">
                        {new Date(h.start_at).toLocaleDateString('pt-BR', { weekday: 'short' })}
                      </p>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-primary">
                        {h.service_name}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-secondary">
                        com {h.professional?.full_name ?? 'a equipe'} · {brl(h.service_price)}
                      </p>

                      {h.notes.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {h.notes.map((n) => (
                            <div
                              key={n.id}
                              className="rounded-xl border border-accent/25 bg-accent-soft/60 p-2.5"
                            >
                              {n.payload.text && (
                                <p className="flex items-start gap-1.5 text-[12.5px] text-primary">
                                  <NotePencil size={13} weight="duotone" className="mt-0.5 shrink-0 text-accent" />
                                  {n.payload.text}
                                </p>
                              )}
                              {!!n.payload.photos?.length && (
                                <div className="mt-2 flex gap-2 overflow-x-auto hide-scrollbar">
                                  {n.payload.photos.map((src, idx) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      key={idx}
                                      src={src}
                                      alt="Estilo do corte"
                                      className="h-20 w-20 shrink-0 rounded-xl border border-border object-cover"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {h.notes.length === 0 && (
                        <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted">
                          <ImageSquare size={13} /> Sem fotos ou anotações deste atendimento
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-border-subtle px-4 py-3">
                    <Link
                      href={`/b/${org.slug}?service=${h.service_id}`}
                      className="flex items-center justify-center gap-2 rounded-2xl border border-accent/30 bg-accent-soft py-2.5 text-[13.5px] font-semibold text-accent transition active:scale-[0.98]"
                    >
                      <ArrowClockwise size={16} weight="bold" /> Repetir agendamento
                    </Link>
                  </div>
                </motion.article>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
