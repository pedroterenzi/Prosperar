'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Clock,
  FloppyDisk,
  PencilSimple,
  Plus,
  Scissors,
  Trash,
  UserPlus,
  X,
} from '@phosphor-icons/react';
import AppShell, { Panel } from '@/components/app/AppShell';
import { Segmented, Skeleton, brl } from '@/components/app/ui';
import {
  deleteProfessional,
  fetchAvailability,
  fetchOrganization,
  fetchProfessionals,
  fetchServices,
  replaceAvailabilityRules,
  saveProfessional,
  saveService,
  toggleService,
  updateOrganization,
} from '@/lib/api/admin';
import { getMyOrgId } from '@/lib/api/session';
import type { AvailabilityRule, Organization, Professional, Service } from '@/lib/api/types';
import { onlyDigits, formatPhoneDigits, toE164 } from '@/lib/booking/format';

type Tab = 'hours' | 'team' | 'services';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function AdminSettingsPage() {
  const [tab, setTab] = useState<Tab>('hours');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const id = await getMyOrgId();
      if (!id) return;
      setOrgId(id);
      try {
        setOrg(await fetchOrganization(id));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Falha ao carregar configurações.');
      }
    })();
  }, []);

  return (
    <AppShell
      title="Configurações"
      subtitle={org ? `${org.name} · /b/${org.slug}` : 'Carregando…'}
    >
      <div className="space-y-5">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'hours', label: 'Expediente' },
            { value: 'team', label: 'Barbeiros' },
            { value: 'services', label: 'Serviços' },
          ]}
        />

        {error && (
          <p className="rounded-2xl border border-critical/40 bg-critical/10 px-4 py-3 text-[13px] text-critical">
            {error}
          </p>
        )}

        {!orgId ? (
          <Skeleton className="h-64" />
        ) : tab === 'hours' ? (
          <HoursPanel orgId={orgId} org={org} onSaved={setOrg} />
        ) : tab === 'team' ? (
          <TeamPanel orgId={orgId} />
        ) : (
          <ServicesPanel orgId={orgId} />
        )}
      </div>
    </AppShell>
  );
}

/* ══════════════════════════════ EXPEDIENTE ═════════════════════════════════ */

type Window = { start_time: string; end_time: string };

function HoursPanel({
  orgId,
  org,
  onSaved,
}: {
  orgId: string;
  org: Organization | null;
  onSaved: (o: Organization) => void;
}) {
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [interval, setIntervalMin] = useState(30);
  const [policy, setPolicy] = useState(4);

  // janelas por dia (escopo "casa toda")
  const [draft, setDraft] = useState<Record<number, Window[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchAvailability(orgId);
    setRules(data);

    const byDay: Record<number, Window[]> = {};
    for (let d = 0; d < 7; d++) {
      byDay[d] = data
        .filter((r) => r.weekday === d && r.professional_id === null)
        .map((r) => ({ start_time: r.start_time.slice(0, 5), end_time: r.end_time.slice(0, 5) }))
        .sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    setDraft(byDay);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!org) return;
    setIntervalMin(org.settings?.slot_interval_min ?? 30);
    setPolicy(org.settings?.cancellation_policy_hours ?? 4);
  }, [org]);

  function setDay(d: number, windows: Window[]) {
    setDraft((prev) => ({ ...prev, [d]: windows }));
  }

  function addWindow(d: number) {
    const current = draft[d] ?? [];
    const last = current[current.length - 1];
    setDay(d, [...current, { start_time: last?.end_time ?? '09:00', end_time: '20:00' }]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      for (let d = 0; d < 7; d++) {
        const windows = (draft[d] ?? []).filter((w) => w.start_time < w.end_time);
        const existing = rules.filter((r) => r.weekday === d && r.professional_id === null);

        // nada mudou nesse dia → pula
        const unchanged =
          existing.length === windows.length &&
          existing.every((r, i) => {
            const w = windows[i];
            return w && r.start_time.slice(0, 5) === w.start_time && r.end_time.slice(0, 5) === w.end_time;
          });
        if (unchanged) continue;

        await replaceAvailabilityRules({ orgId, professionalId: null, weekday: d, windows });
      }

      const nextSettings = { ...(org?.settings ?? {}), slot_interval_min: interval, cancellation_policy_hours: policy };
      await updateOrganization(orgId, { settings: nextSettings });
      if (org) onSaved({ ...org, settings: nextSettings });

      await load();
      setSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-80" />;

  return (
    <div className="space-y-5">
      <Panel
        title="Expediente da casa"
        description="Vale para toda a equipe. Adicione uma segunda faixa para o intervalo de almoço."
      >
        <div className="space-y-2.5">
          {WEEKDAYS.map((label, d) => {
            const windows = draft[d] ?? [];
            const closed = windows.length === 0;
            return (
              <div key={d} className="rounded-2xl border border-border bg-surface p-3">
                <div className="flex items-center justify-between">
                  <span className={`text-[14px] font-semibold ${closed ? 'text-muted' : 'text-primary'}`}>
                    {label}
                  </span>
                  <button
                    onClick={() => (closed ? addWindow(d) : setDay(d, []))}
                    className={`text-[12px] font-semibold ${closed ? 'text-accent' : 'text-muted'}`}
                  >
                    {closed ? 'Abrir' : 'Fechar'}
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {windows.map((w, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 flex items-center gap-2 overflow-hidden"
                    >
                      <input
                        type="time"
                        className="field !py-2 text-center"
                        value={w.start_time}
                        onChange={(e) =>
                          setDay(
                            d,
                            windows.map((x, j) => (j === i ? { ...x, start_time: e.target.value } : x))
                          )
                        }
                      />
                      <span className="text-muted">→</span>
                      <input
                        type="time"
                        className="field !py-2 text-center"
                        value={w.end_time}
                        onChange={(e) =>
                          setDay(
                            d,
                            windows.map((x, j) => (j === i ? { ...x, end_time: e.target.value } : x))
                          )
                        }
                      />
                      <button
                        onClick={() => setDay(d, windows.filter((_, j) => j !== i))}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border text-muted transition hover:text-critical"
                        aria-label="Remover faixa"
                      >
                        <Trash size={15} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {!closed && (
                  <button
                    onClick={() => addWindow(d)}
                    className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-accent"
                  >
                    <Plus size={12} weight="bold" /> faixa (almoço)
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Regras de agendamento" description="Como os horários aparecem para o cliente.">
        <div className="space-y-3">
          <div>
            <label className="step-label">Intervalo entre horários</label>
            <div className="grid grid-cols-4 gap-2">
              {[15, 20, 30, 45].map((v) => (
                <button
                  key={v}
                  onClick={() => setIntervalMin(v)}
                  className={`rounded-2xl border py-3 text-[13px] font-semibold transition ${
                    interval === v
                      ? 'border-accent/40 bg-accent-soft text-accent'
                      : 'border-border bg-surface text-secondary'
                  }`}
                >
                  {v}min
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="step-label">Cancelamento sem custo (horas antes)</label>
            <input
              className="field"
              inputMode="numeric"
              value={policy}
              onChange={(e) => setPolicy(Number(e.target.value.replace(/\D/g, '')) || 0)}
            />
          </div>
        </div>
      </Panel>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} className="btn-primary" disabled={saving}>
          <FloppyDisk size={18} weight="duotone" />
          {saving ? 'Salvando…' : 'Salvar expediente'}
        </button>
        {savedAt && <span className="text-[12px] text-positive">Salvo às {savedAt}</span>}
      </div>
    </div>
  );
}

/* ══════════════════════════════ BARBEIROS ══════════════════════════════════ */

type ProDraft = {
  id?: string;
  full_name: string;
  email: string;
  phone: string;
  pix_key: string;
  color: string;
  commission: string; // comissão % aplicada como override em todos os serviços
};

const PRO_EMPTY: ProDraft = {
  full_name: '',
  email: '',
  phone: '',
  pix_key: '',
  color: '#c9a227',
  commission: '',
};

const PALETTE = ['#c9a227', '#60a5fa', '#34d399', '#f472b6', '#fb923c', '#a78bfa'];

function TeamPanel({ orgId }: { orgId: string }) {
  const [team, setTeam] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<ProDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [t, s] = await Promise.all([fetchProfessionals(orgId), fetchServices(orgId)]);
    setTeam(t);
    setServices(s);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    if (!draft || draft.full_name.trim().length < 2) return;
    setSaving(true);
    try {
      const saved = await saveProfessional({
        id: draft.id,
        org_id: orgId,
        full_name: draft.full_name.trim(),
        email: draft.email.trim() || null,
        phone: draft.phone ? toE164(onlyDigits(draft.phone)) : null,
        pix_key: draft.pix_key.trim() || null,
        color: draft.color,
      });

      // comissão por serviço (override) — aplica na equipe inteira do catálogo ativo
      const pct = Number(draft.commission.replace(',', '.'));
      if (draft.commission && !Number.isNaN(pct)) {
        const { supabase } = await import('@/lib/supabase/client');
        await supabase.from('professional_services').upsert(
          services
            .filter((s) => s.active)
            .map((s) => ({
              professional_id: saved.id,
              service_id: s.id,
              commission_pct_override: pct,
              active: true,
            }))
        );
      }

      await load();
      setDraft(null);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-72" />;

  return (
    <>
      <Panel
        title="Equipe"
        description={`${team.filter((t) => t.active).length} profissionais ativos`}
        action={
          <button
            onClick={() => setDraft({ ...PRO_EMPTY })}
            className="grid h-9 w-9 place-items-center rounded-xl border border-accent/30 bg-accent-soft text-accent"
            aria-label="Adicionar barbeiro"
          >
            <UserPlus size={16} weight="bold" />
          </button>
        }
      >
        <div className="space-y-2.5">
          {team.filter((t) => t.active).length === 0 && (
            <p className="py-6 text-center text-[13px] text-muted">
              Nenhum profissional cadastrado ainda.
            </p>
          )}
          {team
            .filter((t) => t.active)
            .map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
              >
                <span
                  className="h-10 w-1.5 shrink-0 rounded-full"
                  style={{ background: p.color ?? 'var(--accent)' }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold text-primary">{p.full_name}</p>
                  <p className="truncate text-[12px] text-muted">
                    {p.email ? p.email : p.phone ? formatPhoneDigits(onlyDigits(p.phone)) : 'sem contato'}
                    {p.pix_key ? ` · PIX ${p.pix_key}` : ''}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setDraft({
                      id: p.id,
                      full_name: p.full_name,
                      email: p.email ?? '',
                      phone: p.phone ? onlyDigits(p.phone).replace(/^55/, '') : '',
                      pix_key: p.pix_key ?? '',
                      color: p.color ?? '#c9a227',
                      commission: '',
                    })
                  }
                  className="grid h-9 w-9 place-items-center rounded-xl border border-border text-secondary hover:text-primary"
                  aria-label="Editar"
                >
                  <PencilSimple size={15} />
                </button>
                <button
                  onClick={async () => {
                    await deleteProfessional(p.id);
                    load();
                  }}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-border text-secondary hover:text-critical"
                  aria-label="Desativar"
                >
                  <Trash size={15} />
                </button>
              </div>
            ))}
        </div>
      </Panel>

      <AnimatePresence>
        {draft && (
          <Sheet title={draft.id ? 'Editar barbeiro' : 'Novo barbeiro'} onClose={() => setDraft(null)}>
            <label className="block">
              <span className="step-label">Nome</span>
              <input
                className="field"
                value={draft.full_name}
                onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
                placeholder="Rafael Souza"
              />
            </label>
            <label className="block">
              <span className="step-label">E-mail (login do barbeiro)</span>
              <input
                className="field"
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                placeholder="rafael@email.com"
              />
              <span className="mt-1 block text-[11.5px] text-muted">
                Ao usar este e-mail no cadastro, o painel do barbeiro é liberado automaticamente.
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="step-label">WhatsApp</span>
                <input
                  className="field"
                  inputMode="tel"
                  value={formatPhoneDigits(draft.phone)}
                  onChange={(e) => setDraft({ ...draft, phone: onlyDigits(e.target.value) })}
                  placeholder="(11) 98765-4321"
                />
              </label>
              <label className="block">
                <span className="step-label">Chave PIX</span>
                <input
                  className="field"
                  value={draft.pix_key}
                  onChange={(e) => setDraft({ ...draft, pix_key: e.target.value })}
                  placeholder="CPF, e-mail, celular…"
                />
              </label>
            </div>

            <label className="block">
              <span className="step-label">Comissão (% sobre serviços)</span>
              <input
                className="field"
                inputMode="decimal"
                value={draft.commission}
                onChange={(e) => setDraft({ ...draft, commission: e.target.value })}
                placeholder={`Padrão do serviço (ex.: 40)`}
              />
              <span className="mt-1 block text-[11.5px] text-muted">
                Preencha só se este barbeiro tem comissão diferente da casa.
              </span>
            </label>

            <div>
              <span className="step-label">Cor na agenda</span>
              <div className="flex gap-2">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setDraft({ ...draft, color: c })}
                    className={`h-9 w-9 rounded-full border-2 transition ${
                      draft.color === c ? 'border-primary scale-110' : 'border-transparent'
                    }`}
                    style={{ background: c }}
                    aria-label={`Cor ${c}`}
                  />
                ))}
              </div>
            </div>

            <div className="mt-2 flex gap-3">
              <button className="btn-glass" onClick={() => setDraft(null)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </Sheet>
        )}
      </AnimatePresence>
    </>
  );
}

/* ══════════════════════════════ SERVIÇOS ═══════════════════════════════════ */

type SvcDraft = {
  id?: string;
  name: string;
  description: string;
  price: string;
  duration_min: string;
  commission_pct: string;
};

const SVC_EMPTY: SvcDraft = {
  name: '',
  description: '',
  price: '',
  duration_min: '30',
  commission_pct: '40',
};

function ServicesPanel({ orgId }: { orgId: string }) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<SvcDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setServices(await fetchServices(orgId));
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const margin = useMemo(() => {
    if (!draft) return 0;
    const price = Number(draft.price.replace(',', '.')) || 0;
    const commission = Number(draft.commission_pct.replace(',', '.')) || 0;
    return price * (1 - commission / 100);
  }, [draft]);

  async function handleSave() {
    if (!draft || draft.name.trim().length < 2) return;
    setSaving(true);
    try {
      await saveService({
        id: draft.id,
        org_id: orgId,
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        price: Number(draft.price.replace(',', '.')) || 0,
        duration_min: Number(draft.duration_min) || 30,
        commission_pct: Number(draft.commission_pct.replace(',', '.')) || 0,
      });
      await load();
      setDraft(null);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-72" />;

  return (
    <>
      <Panel
        title="Catálogo de serviços"
        description={`${services.filter((s) => s.active).length} ativos na página pública`}
        action={
          <button
            onClick={() => setDraft({ ...SVC_EMPTY })}
            className="grid h-9 w-9 place-items-center rounded-xl border border-accent/30 bg-accent-soft text-accent"
            aria-label="Novo serviço"
          >
            <Plus size={16} weight="bold" />
          </button>
        }
      >
        <div className="space-y-2.5">
          {services.length === 0 && (
            <p className="py-6 text-center text-[13px] text-muted">
              Cadastre o primeiro serviço para liberar o agendamento público.
            </p>
          )}
          {services.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
                s.active ? 'border-border bg-surface' : 'border-border-subtle bg-surface opacity-50'
              }`}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                <Scissors size={17} weight="duotone" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-semibold text-primary">{s.name}</p>
                <p className="truncate text-[12px] text-muted">
                  {s.duration_min}min · comissão {s.commission_pct}%
                </p>
              </div>
              <span className="shrink-0 text-[14px] font-semibold text-accent">{brl(s.price)}</span>
              <button
                onClick={() =>
                  setDraft({
                    id: s.id,
                    name: s.name,
                    description: s.description ?? '',
                    price: String(s.price),
                    duration_min: String(s.duration_min),
                    commission_pct: String(s.commission_pct),
                  })
                }
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border text-secondary hover:text-primary"
                aria-label="Editar"
              >
                <PencilSimple size={15} />
              </button>
            </div>
          ))}
        </div>
      </Panel>

      <AnimatePresence>
        {draft && (
          <Sheet title={draft.id ? 'Editar serviço' : 'Novo serviço'} onClose={() => setDraft(null)}>
            <label className="block">
              <span className="step-label">Nome</span>
              <input
                className="field"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Corte + barba"
              />
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <span className="step-label">Preço</span>
                <input
                  className="field"
                  inputMode="decimal"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                  placeholder="60"
                />
              </label>
              <label className="block">
                <span className="step-label">Duração</span>
                <input
                  className="field"
                  inputMode="numeric"
                  value={draft.duration_min}
                  onChange={(e) =>
                    setDraft({ ...draft, duration_min: e.target.value.replace(/\D/g, '') })
                  }
                  placeholder="30"
                />
              </label>
              <label className="block">
                <span className="step-label">Comissão %</span>
                <input
                  className="field"
                  inputMode="decimal"
                  value={draft.commission_pct}
                  onChange={(e) => setDraft({ ...draft, commission_pct: e.target.value })}
                  placeholder="40"
                />
              </label>
            </div>
            <p className="flex items-center gap-1.5 text-[12px] text-muted">
              <Clock size={13} /> Sobra para a casa antes de custos: <b className="text-primary">{brl(margin)}</b>
            </p>

            <div className="mt-2 flex gap-3">
              <button className="btn-glass" onClick={() => setDraft(null)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar serviço'}
              </button>
            </div>

            {draft.id && (
              <button
                onClick={async () => {
                  const current = services.find((s) => s.id === draft.id);
                  if (!current) return;
                  await toggleService(draft.id!, !current.active);
                  await load();
                  setDraft(null);
                }}
                className="w-full text-center text-[12.5px] font-semibold text-muted"
              >
                {services.find((s) => s.id === draft.id)?.active
                  ? 'Desativar este serviço'
                  : 'Reativar este serviço'}
              </button>
            )}
          </Sheet>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─────────────────────────── sheet compartilhada ─────────────────────────── */

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-6"
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong w-full max-w-lg space-y-4 p-5 sm:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-primary">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-primary" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}
