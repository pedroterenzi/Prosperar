'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Eye,
  EyeSlash,
  Package,
  PencilSimple,
  Plus,
  Trash,
  X,
} from '@phosphor-icons/react';
import AppShell, { EmptyState } from '@/components/app/AppShell';
import { Skeleton, brl } from '@/components/app/ui';
import {
  deleteProduct,
  fetchProducts,
  saveProduct,
} from '@/lib/api/admin';
import { getMyOrgId } from '@/lib/api/session';
import type { Product } from '@/lib/api/types';

type Draft = {
  id?: string;
  name: string;
  description: string;
  price: string;
  cost: string;
  stock_qty: string;
  track_stock: boolean;
  show_in_store: boolean;
};

const EMPTY: Draft = {
  name: '',
  description: '',
  price: '',
  cost: '',
  stock_qty: '',
  track_stock: false,
  show_in_store: true,
};

export default function AdminProductsPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      setProducts(await fetchProducts(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar produtos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const id = await getMyOrgId();
      if (!id) return;
      setOrgId(id);
      load(id);
    })();
  }, [load]);

  async function handleSave() {
    if (!orgId || !draft) return;
    if (draft.name.trim().length < 2) {
      setError('Informe o nome do produto.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveProduct({
        id: draft.id,
        org_id: orgId,
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        price: Number(draft.price.replace(',', '.')) || 0,
        cost: Number(draft.cost.replace(',', '.')) || 0,
        stock_qty: draft.track_stock ? Number(draft.stock_qty) || 0 : null,
        track_stock: draft.track_stock,
        show_in_store: draft.show_in_store,
      });
      await load(orgId);
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStore(p: Product) {
    if (!orgId) return;
    setProducts((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, show_in_store: !x.show_in_store } : x))
    );
    try {
      await saveProduct({ ...p, show_in_store: !p.show_in_store });
    } catch {
      setProducts((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, show_in_store: p.show_in_store } : x))
      );
    }
  }

  async function handleDelete(p: Product) {
    if (!orgId) return;
    setProducts((prev) => prev.filter((x) => x.id !== p.id));
    try {
      await deleteProduct(p.id);
    } catch {
      load(orgId);
    }
  }

  return (
    <AppShell
      title="Produtos e loja"
      subtitle="Vitrine que o cliente reserva para retirar na barbearia"
      action={
        <button
          onClick={() => setDraft({ ...EMPTY })}
          className="grid h-10 w-10 place-items-center rounded-2xl border border-accent/30 bg-accent-soft text-accent transition active:scale-95"
          aria-label="Novo produto"
        >
          <Plus size={18} weight="bold" />
        </button>
      }
    >
      <div className="space-y-4">
        {error && (
          <p className="rounded-2xl border border-critical/40 bg-critical/10 px-4 py-3 text-[13px] text-critical">
            {error}
          </p>
        )}

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : products.filter((p) => p.active).length === 0 ? (
          <EmptyState
            icon={<Package size={22} weight="duotone" />}
            title="Nenhum produto cadastrado"
            hint="Cadastre pomadas, óleos e shampoos para aparecerem na loja do cliente."
            action={
              <button onClick={() => setDraft({ ...EMPTY })} className="btn-primary !w-auto px-6">
                <Plus size={16} weight="bold" /> Novo produto
              </button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {products
              .filter((p) => p.active)
              .map((p, i) => (
                <motion.article
                  key={p.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="glass flex flex-col p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-semibold text-primary">{p.name}</h3>
                      {p.description && (
                        <p className="mt-0.5 line-clamp-2 text-[12.5px] text-secondary">
                          {p.description}
                        </p>
                      )}
                    </div>
                    <span className="badge-gold shrink-0">{brl(p.price)}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                    <span>Custo {brl(p.cost)}</span>
                    <span className="opacity-40">·</span>
                    <span>
                      {p.track_stock ? `Estoque ${p.stock_qty ?? 0}` : 'Sem controle de estoque'}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => handleToggleStore(p)}
                      className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-semibold transition ${
                        p.show_in_store
                          ? 'border-positive/40 bg-positive/10 text-positive'
                          : 'border-border bg-surface text-muted'
                      }`}
                    >
                      {p.show_in_store ? <Eye size={14} weight="duotone" /> : <EyeSlash size={14} weight="duotone" />}
                      {p.show_in_store ? 'Na loja' : 'Oculto'}
                    </button>

                    <button
                      onClick={() =>
                        setDraft({
                          id: p.id,
                          name: p.name,
                          description: p.description ?? '',
                          price: String(p.price),
                          cost: String(p.cost),
                          stock_qty: String(p.stock_qty ?? 0),
                          track_stock: p.track_stock,
                          show_in_store: p.show_in_store,
                        })
                      }
                      className="ml-auto grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface text-secondary transition hover:text-primary"
                      aria-label="Editar"
                    >
                      <PencilSimple size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface text-secondary transition hover:text-critical"
                      aria-label="Remover"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </motion.article>
              ))}
          </div>
        )}
      </div>

      {/* ------------------------------ bottom sheet ------------------------- */}
      <AnimatePresence>
        {draft && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
            onClick={() => setDraft(null)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong w-full max-w-lg rounded-b-none p-5 sm:rounded-3xl"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-semibold text-primary">
                  {draft.id ? 'Editar produto' : 'Novo produto'}
                </h2>
                <button onClick={() => setDraft(null)} className="text-muted hover:text-primary">
                  <X size={20} />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <Field label="Nome">
                  <input
                    className="field"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Pomada modeladora"
                  />
                </Field>
                <Field label="Descrição">
                  <textarea
                    className="field min-h-[72px] resize-none"
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder="Fixa forte, efeito matte, 120g"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Preço de venda">
                    <input
                      className="field"
                      inputMode="decimal"
                      value={draft.price}
                      onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                      placeholder="39,90"
                    />
                  </Field>
                  <Field label="Custo">
                    <input
                      className="field"
                      inputMode="decimal"
                      value={draft.cost}
                      onChange={(e) => setDraft({ ...draft, cost: e.target.value })}
                      placeholder="18,00"
                    />
                  </Field>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3">
                  <span className="text-[13.5px] text-primary">Controlar estoque</span>
                  <Toggle
                    checked={draft.track_stock}
                    onChange={(v) => setDraft({ ...draft, track_stock: v })}
                  />
                </div>

                {draft.track_stock && (
                  <Field label="Quantidade em estoque">
                    <input
                      className="field"
                      inputMode="numeric"
                      value={draft.stock_qty}
                      onChange={(e) =>
                        setDraft({ ...draft, stock_qty: e.target.value.replace(/\D/g, '') })
                      }
                      placeholder="12"
                    />
                  </Field>
                )}

                <div className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3">
                  <span className="text-[13.5px] text-primary">Exibir na loja do cliente</span>
                  <Toggle
                    checked={draft.show_in_store}
                    onChange={(v) => setDraft({ ...draft, show_in_store: v })}
                  />
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <button className="btn-glass" onClick={() => setDraft(null)}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Salvando…' : 'Salvar produto'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="step-label">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
        checked ? 'border-accent/40 bg-accent' : 'border-border bg-surface'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 34 }}
        className={`absolute top-0.5 h-4.5 w-4.5 rounded-full ${
          checked ? 'left-[22px] bg-accent-contrast' : 'left-0.5 bg-muted'
        }`}
        style={{ height: 18, width: 18 }}
      />
    </button>
  );
}
