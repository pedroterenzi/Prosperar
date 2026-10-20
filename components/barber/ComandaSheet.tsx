'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  CreditCard,
  Minus,
  NotePencil,
  Plus,
  Receipt,
  Trash,
  X,
} from '@phosphor-icons/react';
import {
  addComandaItem,
  addAppointmentNote,
  closeComanda,
  fetchComandaCatalog,
  fetchOrder,
  openComanda,
  removeComandaItem,
} from '@/lib/api/barber';
import { brl } from '@/components/app/ui';
import type { Appointment, Order, PaymentMethod, Product } from '@/lib/api/types';

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'pix', label: 'PIX' },
  { value: 'credit', label: 'Crédito' },
  { value: 'debit', label: 'Débito' },
  { value: 'cash', label: 'Dinheiro' },
];

const TIPS = [0, 5, 10, 15];

/**
 * Comanda do atendimento: abre, soma produtos/serviços, registra anotação
 * com o histórico do corte e fecha com pagamento (dispara comissão e pontos).
 */
export default function ComandaSheet({
  appointment,
  orgId,
  onClose,
  onClosed,
}: {
  appointment: Appointment;
  orgId: string;
  onClose: () => void;
  onClosed: () => void;
}) {
  const [order, setOrder] = useState<Order | null>(null);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<'items' | 'note' | 'pay'>('items');
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [tip, setTip] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [note, setNote] = useState('');
  const [done, setDone] = useState<{ total: number } | null>(null);

  const refresh = useCallback(async (orderId: string) => {
    setOrder(await fetchOrder(orderId));
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const orderId = await openComanda(appointment.id);
        if (!alive) return;
        await refresh(orderId);
        const cat = await fetchComandaCatalog(orgId);
        if (alive) setCatalog(cat.filter((p) => p.active));
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Falha ao abrir a comanda.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [appointment.id, orgId, refresh]);

  // Gorjeta é percentual sobre o que o cliente realmente paga (subtotal − desconto).
  const tipValue = useMemo(() => {
    if (!order) return 0;
    const base = Math.max(0, Number(order.subtotal) - discount);
    return Math.round(base * (tip / 100) * 100) / 100;
  }, [order, discount, tip]);

  const total = useMemo(() => {
    if (!order) return 0;
    return Math.max(0, Number(order.subtotal) - discount + tipValue);
  }, [order, discount, tipValue]);

  async function changeQty(product: Product, delta: number) {
    if (!order) return;
    setBusy(true);
    setError(null);
    try {
      const existing = order.items.find((i) => i.ref_id === product.id && i.kind === 'product');
      if (delta < 0 && existing) {
        if (existing.qty <= 1) await removeComandaItem(existing.id);
        else await removeComandaItem(existing.id); // remove e re-adiciona na qtd certa
        if (existing.qty > 1) {
          await addComandaItem(order.id, 'product', product.id, existing.qty - 1);
        }
      } else {
        await addComandaItem(order.id, 'product', product.id, 1);
      }
      await refresh(order.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível alterar o item.');
    } finally {
      setBusy(false);
    }
  }

  async function saveNote() {
    if (!note.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addAppointmentNote(appointment.id, note.trim(), []);
      setNote('');
      setTab('items');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar a anotação.');
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!order) return;
    setBusy(true);
    setError(null);
    try {
      const res = await closeComanda({ orderId: order.id, method, tip: tipValue, discount });
      setDone(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível fechar a comanda.');
    } finally {
      setBusy(false);
    }
  }

  const qtyOf = (productId: string) =>
    order?.items.filter((i) => i.ref_id === productId && i.kind === 'product').reduce((s, i) => s + i.qty, 0) ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-6"
    >
      <motion.div
        initial={{ y: 70, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 70, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-b-none sm:rounded-3xl"
      >
        {/* header */}
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[16px] font-semibold text-primary">
              <Receipt size={18} weight="duotone" className="text-accent" />
              Comanda
            </h2>
            <p className="mt-0.5 truncate text-[12.5px] text-secondary">
              {appointment.customer?.full_name ?? 'Cliente'} · {appointment.service_name}
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 text-muted hover:text-primary" aria-label="Fechar">
            <X size={20} />
          </button>
        </header>

        {done ? (
          /* ── sucesso ─────────────────────────────────────────────────── */
          <div className="space-y-4 p-6 text-center">
            <motion.span
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-positive/40 bg-positive/10 text-positive"
            >
              <Check size={32} weight="bold" />
            </motion.span>
            <div>
              <p className="text-[18px] font-semibold text-primary">Comanda fechada!</p>
              <p className="mt-1 text-[13px] text-secondary">
                Pagamento registrado · comissão e fidelidade atualizadas.
              </p>
            </div>
            <p className="text-[28px] font-bold text-accent">{brl(done.total)}</p>
            <button className="btn-primary" onClick={onClosed}>
              Concluir atendimento
            </button>
          </div>
        ) : loading ? (
          <div className="p-6">
            <div className="skeleton h-40" />
          </div>
        ) : (
          <>
            {/* tabs */}
            <div className="flex gap-1 border-b border-border px-3 py-2 text-[13px] font-semibold">
              {(['items', 'note', 'pay'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 rounded-xl px-3 py-2 transition ${
                    tab === t ? 'bg-accent text-accent-contrast' : 'text-secondary hover:text-primary'
                  }`}
                >
                  {t === 'items' ? 'Itens' : t === 'note' ? 'Anotação' : 'Pagamento'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {error && (
                <p className="mb-4 rounded-2xl border border-critical/40 bg-critical/10 px-4 py-3 text-[13px] text-critical">
                  {error}
                </p>
              )}

              {tab === 'items' && order && (
                <div className="space-y-5">
                  <div>
                    <span className="step-label">Na comanda</span>
                    {order.items.length === 0 ? (
                      <p className="text-[13px] text-muted">Nenhum item ainda.</p>
                    ) : (
                      <div className="space-y-2">
                        {order.items.map((i) => (
                          <div
                            key={i.id}
                            className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2.5"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13.5px] font-medium text-primary">{i.name}</p>
                              <p className="text-[12px] text-secondary">
                                {i.qty} × {brl(i.unit_price)}
                              </p>
                            </div>
                            <span className="text-[13.5px] font-semibold text-primary">{brl(i.total)}</span>
                            {i.kind === 'product' && (
                              <button
                                disabled={busy}
                                onClick={async () => {
                                  setBusy(true);
                                  try {
                                    await removeComandaItem(i.id);
                                    await refresh(order.id);
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                                className="text-muted hover:text-critical disabled:opacity-40"
                                aria-label="Remover"
                              >
                                <Trash size={15} weight="duotone" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {catalog.length > 0 && (
                    <div>
                      <span className="step-label">Adicionar produto</span>
                      <div className="space-y-2">
                        {catalog.map((p) => {
                          const q = qtyOf(p.id);
                          return (
                            <div
                              key={p.id}
                              className="flex items-center gap-3 rounded-2xl border border-border px-3 py-2.5"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13.5px] text-primary">{p.name}</p>
                                <p className="text-[12px] text-accent">{brl(p.price)}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {q > 0 && (
                                  <button
                                    disabled={busy}
                                    onClick={() => changeQty(p, -1)}
                                    className="grid h-8 w-8 place-items-center rounded-lg border border-border text-secondary disabled:opacity-40"
                                  >
                                    <Minus size={14} weight="bold" />
                                  </button>
                                )}
                                {q > 0 && <span className="w-5 text-center text-[14px] font-semibold">{q}</span>}
                                <button
                                  disabled={busy}
                                  onClick={() => changeQty(p, 1)}
                                  className="grid h-8 w-8 place-items-center rounded-lg border border-accent/30 bg-accent-soft text-accent disabled:opacity-40"
                                >
                                  <Plus size={14} weight="bold" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === 'note' && (
                <div className="space-y-3">
                  <label className="block">
                    <span className="step-label">Anotação do profissional</span>
                    <textarea
                      className="field min-h-[110px] resize-none"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Ex.: máquina 2 nas laterais, tesoura no topo, cliente prefere risco esquerdo…"
                    />
                  </label>
                  <p className="flex items-center gap-1.5 text-[12px] text-muted">
                    <NotePencil size={13} weight="duotone" />
                    Aparece no histórico do cliente para repetir o mesmo corte.
                  </p>
                  <button className="btn-primary" onClick={saveNote} disabled={busy || !note.trim()}>
                    Salvar anotação
                  </button>
                </div>
              )}

              {tab === 'pay' && order && (
                <div className="space-y-5">
                  <div>
                    <span className="step-label">Forma de pagamento</span>
                    <div className="grid grid-cols-2 gap-2">
                      {METHODS.map((m) => (
                        <button
                          key={m.value}
                          onClick={() => setMethod(m.value)}
                          className={`flex items-center justify-center gap-2 rounded-2xl border py-3 text-[13px] font-semibold transition ${
                            method === m.value
                              ? 'border-accent/40 bg-accent-soft text-accent'
                              : 'border-border bg-surface text-secondary'
                          }`}
                        >
                          <CreditCard size={15} weight="duotone" /> {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="step-label">Gorjeta</span>
                    <div className="grid grid-cols-4 gap-2">
                      {TIPS.map((t) => (
                        <button
                          key={t}
                          onClick={() => setTip(t)}
                          className={`rounded-2xl border py-3 text-[13px] font-semibold transition ${
                            tip === t
                              ? 'border-accent/40 bg-accent-soft text-accent'
                              : 'border-border bg-surface text-secondary'
                          }`}
                        >
                          {t === 0 ? 'Sem' : `${t}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="block">
                    <span className="step-label">Desconto (R$)</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="field"
                      value={discount || ''}
                      onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                      placeholder="0,00"
                    />
                  </label>

                  <div className="space-y-1.5 rounded-2xl border border-border bg-surface p-4 text-[13.5px]">
                    <Row label="Subtotal" value={brl(order.subtotal)} />
                    {discount > 0 && <Row label="Desconto" value={`− ${brl(discount)}`} />}
                    {tip > 0 && <Row label={`Gorjeta (${tip}%)`} value={brl(tipValue)} />}
                    <div className="mt-2 flex items-center justify-between border-t border-border pt-2.5">
                      <span className="text-[14px] font-semibold text-primary">Total</span>
                      <span className="text-[18px] font-bold text-accent">{brl(total)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* footer sticky */}
            {tab !== 'note' && order && (
              <footer className="flex items-center gap-3 border-t border-border px-5 py-4">
                <div className="flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Total</p>
                  <p className="text-[19px] font-bold text-accent">{brl(total)}</p>
                </div>
                {tab === 'items' ? (
                  <button className="btn-primary !w-auto px-6" onClick={() => setTab('pay')}>
                    Ir para pagamento
                  </button>
                ) : (
                  <button className="btn-primary !w-auto px-6" onClick={finish} disabled={busy}>
                    {busy ? 'Fechando…' : 'Fechar comanda'}
                  </button>
                )}
              </footer>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

/* helper de linha */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-secondary">
      <span>{label}</span>
      <span className="text-primary">{value}</span>
    </div>
  );
}
