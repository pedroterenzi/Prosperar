'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bag,
  Check,
  Package,
  ShoppingBag,
  Storefront,
  Trash,
  X,
} from '@phosphor-icons/react';
import AppShell, { EmptyState } from '@/components/app/AppShell';
import { PageSection, Skeleton, brl } from '@/components/app/ui';
import {
  cancelReservation,
  fetchMyOrganization,
  fetchMyReservations,
  fetchShopProducts,
  reserveProduct,
} from '@/lib/api/client';
import type { Organization, Product, Reservation } from '@/lib/api/types';

const STATUS_LABEL: Record<Reservation['status'], string> = {
  reserved: 'Reservado',
  picked_up: 'Retirado',
  cancelled: 'Cancelado',
};

export default function ClientShopPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);

  const load = useCallback(async (organization: Organization) => {
    const [list, mine] = await Promise.all([
      fetchShopProducts(organization.id),
      fetchMyReservations(organization.id),
    ]);
    setProducts(list);
    setReservations(mine);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const organization = await fetchMyOrganization();
        setOrg(organization);
        if (organization) await load(organization);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Falha ao carregar a loja.');
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const active = useMemo(
    () => reservations.filter((r) => r.status === 'reserved'),
    [reservations]
  );

  async function handleCancel(id: string) {
    try {
      await cancelReservation(id);
      if (org) await load(org);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível cancelar.');
    }
  }

  return (
    <AppShell
      title="Loja da barbearia"
      subtitle={org ? `${org.name} · reserve e pague na próxima visita` : 'Carregando…'}
    >
      <div className="space-y-5">
        {error && (
          <p className="rounded-2xl border border-critical/40 bg-critical/10 px-4 py-3 text-[13px] text-critical">
            {error}
          </p>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-52" />
            ))}
          </div>
        ) : !org ? (
          <EmptyState
            icon={<Storefront size={22} weight="duotone" />}
            title="Nenhuma barbearia vinculada"
            hint="Agende um horário na sua barbearia para liberar a loja de produtos."
            action={
              <Link href="/b/demo" className="btn-primary !w-auto px-6">
                Agendar agora
              </Link>
            }
          />
        ) : (
          <>
            {/* reservas ativas */}
            {active.length > 0 && (
              <PageSection title="Minhas reservas para retirar">
                <div className="space-y-2.5">
                  {active.map((r) => (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass flex items-center gap-3 p-3.5"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-accent/25 bg-accent-soft text-accent">
                        <Package size={20} weight="duotone" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14.5px] font-semibold text-primary">
                          {r.product?.name ?? 'Produto'} {r.qty > 1 ? `× ${r.qty}` : ''}
                        </p>
                        <p className="text-[12px] text-secondary">
                          {brl(Number(r.unit_price) * r.qty)} ·{' '}
                          {STATUS_LABEL[r.status]} — pague na visita
                        </p>
                      </div>
                      <button
                        onClick={() => handleCancel(r.id)}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border text-muted transition hover:text-critical"
                        aria-label="Cancelar reserva"
                      >
                        <Trash size={15} weight="duotone" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </PageSection>
            )}

            {/* vitrine */}
            {products.length === 0 ? (
              <EmptyState
                icon={<ShoppingBag size={22} weight="duotone" />}
                title="A vitrine está sendo montada"
                hint="Em breve a barbearia vai publicar pomadas, óleos e kits por aqui."
              />
            ) : (
              <PageSection title="Pronta-entrega">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  {products.map((p, i) => {
                    const out = p.track_stock && (p.stock_qty ?? 0) <= 0;
                    return (
                      <motion.article
                        key={p.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="glass flex flex-col overflow-hidden"
                      >
                        <div className="relative aspect-[4/3] w-full bg-surface">
                          {p.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.image_url}
                              alt={p.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-muted">
                              <Bag size={28} weight="duotone" />
                            </div>
                          )}
                          {out && (
                            <span className="absolute right-2 top-2 rounded-full bg-critical/90 px-2 py-0.5 text-[10.5px] font-bold text-white">
                              ESGOTADO
                            </span>
                          )}
                          {!out && p.track_stock && (p.stock_qty ?? 0) <= 3 && (
                            <span className="badge-gold absolute right-2 top-2">Últimas un.</span>
                          )}
                        </div>

                        <div className="flex flex-1 flex-col p-3.5">
                          <p className="text-[14.5px] font-semibold leading-tight text-primary">
                            {p.name}
                          </p>
                          {p.description && (
                            <p className="mt-1 line-clamp-2 text-[12px] text-secondary">
                              {p.description}
                            </p>
                          )}
                          <p className="mt-2 text-[16px] font-semibold text-accent">{brl(p.price)}</p>

                          <button
                            disabled={out}
                            onClick={() => setSelected(p)}
                            className="btn-glass mt-3 !py-2.5 !text-[13px] disabled:opacity-45"
                          >
                            {out ? 'Sem estoque' : 'Reservar'}
                          </button>
                        </div>
                      </motion.article>
                    );
                  })}
                </div>
              </PageSection>
            )}

            {/* histórico de reservas */}
            {reservations.some((r) => r.status !== 'reserved') && (
              <PageSection title="Histórico">
                <div className="glass divide-y divide-border">
                  {reservations
                    .filter((r) => r.status !== 'reserved')
                    .map((r) => (
                      <div key={r.id} className="flex items-center justify-between px-4 py-3">
                        <span className="truncate text-[13.5px] text-secondary">
                          {r.product?.name ?? 'Produto'}
                        </span>
                        <span
                          className={`text-[12.5px] font-semibold ${
                            r.status === 'picked_up' ? 'text-positive' : 'text-muted'
                          }`}
                        >
                          {STATUS_LABEL[r.status]}
                        </span>
                      </div>
                    ))}
                </div>
              </PageSection>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {selected && org && (
          <ReserveSheet
            product={selected}
            orgId={org.id}
            onClose={() => setSelected(null)}
            onDone={async () => {
              setSelected(null);
              await load(org);
            }}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

/* ------------------------------ sheet de reserva --------------------------- */

function ReserveSheet({
  product,
  orgId,
  onClose,
  onDone,
}: {
  product: Product;
  orgId: string;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const max = product.track_stock ? Math.max(1, product.stock_qty ?? 1) : 5;

  async function handleReserve() {
    setBusy(true);
    setError(null);
    try {
      const id = await reserveProduct(orgId, product.id, qty);
      setCode(id.slice(0, 8).toUpperCase());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível reservar.');
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
            <Bag size={18} weight="duotone" className="text-accent" /> Reservar produto
          </h2>
          <button onClick={onClose} className="text-muted hover:text-primary" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        {code ? (
          <div className="space-y-4 text-center">
            <motion.span
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-positive/40 bg-positive/10 text-positive"
            >
              <Check size={30} weight="bold" />
            </motion.span>
            <div>
              <p className="text-[17px] font-semibold text-primary">Produto reservado!</p>
              <p className="mt-1 text-[13px] text-secondary">
                Retire e pague no balcão na sua próxima visita.
              </p>
            </div>
            <div className="rounded-2xl border border-dashed border-accent/40 bg-accent-soft px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                Código da reserva
              </p>
              <p className="mt-1 font-mono text-[17px] font-bold tracking-widest text-accent">
                {code}
              </p>
            </div>
            <button className="btn-primary" onClick={() => void onDone()}>
              Ver minhas reservas
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-bg-raised">
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-muted">
                    <Bag size={22} weight="duotone" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[14.5px] font-semibold text-primary">{product.name}</p>
                <p className="text-[13px] text-accent">{brl(product.price)}</p>
                {product.track_stock && (
                  <p className="text-[11.5px] text-muted">
                    {product.stock_qty ?? 0} em estoque
                  </p>
                )}
              </div>
            </div>

            <div>
              <span className="step-label">Quantidade</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="grid h-11 w-11 place-items-center rounded-2xl border border-border text-[18px] text-secondary"
                >
                  −
                </button>
                <span className="w-10 text-center text-[18px] font-semibold text-primary">{qty}</span>
                <button
                  onClick={() => setQty((q) => Math.min(max, q + 1))}
                  className="grid h-11 w-11 place-items-center rounded-2xl border border-border text-[18px] text-secondary"
                >
                  +
                </button>
                <span className="ml-auto text-[15px] font-semibold text-accent">
                  {brl(Number(product.price) * qty)}
                </span>
              </div>
            </div>

            {error && (
              <p className="rounded-2xl border border-critical/40 bg-critical/10 px-4 py-3 text-[13px] text-critical">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button className="btn-glass" onClick={onClose}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleReserve} disabled={busy}>
                {busy ? 'Reservando…' : 'Confirmar reserva'}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
