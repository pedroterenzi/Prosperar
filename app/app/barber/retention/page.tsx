'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Heart,
  Megaphone,
  PhoneCall,
  SealCheck,
  WhatsappLogo,
} from '@phosphor-icons/react';
import AppShell, { EmptyState } from '@/components/app/AppShell';
import { Segmented, Skeleton, brl } from '@/components/app/ui';
import { fetchLostClients, fetchMyProfessional } from '@/lib/api/barber';
import type { LostClient, Professional } from '@/lib/api/types';

type Threshold = '30' | '45' | '60';

/** Mensagem amigável pré-preenchida no WhatsApp. */
function whatsappMessage(client: LostClient, shopName: string): string {
  const first = client.full_name.split(' ')[0];
  const servico = client.last_service ? ` (seu último foi ${client.last_service})` : '';
  return encodeURIComponent(
    `Olá, ${first}! Aqui é da ${shopName} 💈\n\n` +
      `Faz um tempinho que você não aparece${servico} e a sua cadeira está com saudade!\n\n` +
      `Que tal garantir um horário essa semana? Respondo aqui e já reservo pra você.`
  );
}

export default function BarberRetentionPage() {
  const [pro, setPro] = useState<Professional | null>(null);
  const [threshold, setThreshold] = useState<Threshold>('30');
  const [clients, setClients] = useState<LostClient[]>([]);
  const [shopName, setShopName] = useState('nossa barbearia');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await fetchMyProfessional();
        setPro(p);
        if (p) {
          const { supabase } = await import('@/lib/supabase/client');
          const { data } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', p.org_id)
            .maybeSingle();
          if (data?.name) setShopName(data.name);
        }
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
      setClients(await fetchLostClients(pro.org_id, Number(threshold)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar os clientes.');
    } finally {
      setLoading(false);
    }
  }, [pro, threshold]);

  useEffect(() => {
    load();
  }, [load]);

  const recovered = useMemo(() => clients.filter((c) => c.visits_count >= 3).length, [clients]);

  return (
    <AppShell title="Resgate de clientes" subtitle="Quem não aparece há um tempo e sente falta da cadeira">
      <div className="space-y-5">
        <Segmented
          value={threshold}
          onChange={setThreshold}
          options={[
            { value: '30', label: '30+ dias' },
            { value: '45', label: '45+ dias' },
            { value: '60', label: '60+ dias' },
          ]}
        />

        {error && (
          <p className="rounded-2xl border border-critical/40 bg-critical/10 px-4 py-3 text-[13px] text-critical">
            {error}
          </p>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : !pro ? (
          <EmptyState
            icon={<Heart size={22} weight="duotone" />}
            title="Cadeira não vinculada"
            hint="Peça ao gestor para cadastrar o seu e-mail em Ajustes → Barbeiros."
          />
        ) : clients.length === 0 ? (
          <EmptyState
            icon={<SealCheck size={22} weight="duotone" />}
            title="Ninguém sumido nesse período"
            hint="Sua base está em dia. Tente ampliar o intervalo para 60 dias."
          />
        ) : (
          <>
            <div className="glass flex items-center gap-4 p-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
                <Megaphone size={22} weight="duotone" />
              </span>
              <div>
                <p className="text-[15px] font-semibold text-primary">
                  {clients.length} cliente{clients.length > 1 ? 's' : ''} para resgatar
                </p>
                <p className="text-[12.5px] text-secondary">
                  {recovered} são fiéis (3+ visitas) — priorize esses contatos.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {clients.map((c, i) => (
                <motion.article
                  key={c.customer_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="glass p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-border bg-surface text-[13px] font-bold text-accent">
                      {c.full_name
                        .split(' ')
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join('')
                        .toUpperCase()}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[15px] font-semibold text-primary">
                          {c.full_name}
                        </p>
                        {c.visits_count >= 3 && (
                          <span className="badge-gold !text-[10px]">Fiel</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[12.5px] text-secondary">
                        {c.days_away >= 999
                          ? 'Nunca atendido'
                          : `${c.days_away} dias sem aparecer`}
                        {c.last_service ? ` · último: ${c.last_service}` : ''}
                      </p>
                      <p className="mt-1 text-[12px] text-muted">
                        {c.visits_count} visitas · {brl(c.total_spent)} gastos
                        {c.preferred_professional ? ` · gosta de ${c.preferred_professional}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <a
                      href={`https://wa.me/${c.phone.replace(/\D/g, '')}?text=${whatsappMessage(
                        c,
                        shopName
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary !w-auto flex-1 !py-3 !text-[13.5px]"
                    >
                      <WhatsappLogo size={17} weight="fill" /> Chamar no WhatsApp
                    </a>
                    <a
                      href={`tel:${c.phone}`}
                      className="grid h-auto w-12 shrink-0 place-items-center rounded-2xl border border-border bg-surface text-secondary transition hover:text-primary"
                      aria-label="Ligar"
                    >
                      <PhoneCall size={17} weight="duotone" />
                    </a>
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
