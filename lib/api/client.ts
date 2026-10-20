import { supabase } from '@/lib/supabase/client';
import type {
  ClientHistoryItem,
  Organization,
  Product,
  Reservation,
} from './types';

/* -------------------------------- contexto -------------------------------- */

/** Organização do cliente logado (via customers.user_id → RLS org_select). */
export async function fetchMyOrganization(): Promise<Organization | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: customer } = await supabase
    .from('customers')
    .select('org_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!customer?.org_id) return null;

  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, slug, phone, address, timezone, logo_url, settings')
    .eq('id', customer.org_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Organization | null) ?? null;
}

/* -------------------------------- histórico ------------------------------- */

/** Atendimentos concluídos com as anotações/fotos do profissional. */
export async function fetchMyHistory(orgId: string): Promise<ClientHistoryItem[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(
      'id, start_at, status, service_name, service_id, service_price, professional:professionals(full_name)'
    )
    .eq('org_id', orgId)
    .eq('status', 'completed')
    .order('start_at', { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);

  const items = (data as unknown as Omit<ClientHistoryItem, 'notes'>[]) ?? [];
  if (items.length === 0) return [];

  // Uma consulta só para todas as notas (RLS: só os meus atendimentos).
  const { data: notes } = await supabase
    .from('appointment_events')
    .select('id, appointment_id, payload, created_at')
    .in(
      'appointment_id',
      items.map((i) => i.id)
    )
    .eq('type', 'note')
    .order('created_at', { ascending: false });

  type NoteRow = {
    id: number;
    appointment_id: string;
    payload: { text?: string; photos?: string[] };
    created_at: string;
  };

  const byAppt = new Map<string, ClientHistoryItem['notes']>();
  for (const n of (notes ?? []) as NoteRow[]) {
    const list = byAppt.get(n.appointment_id) ?? [];
    list.push({ id: n.id, type: 'note', payload: n.payload, created_at: n.created_at });
    byAppt.set(n.appointment_id, list);
  }

  return items.map((i) => ({ ...i, notes: byAppt.get(i.id) ?? [] }));
}

/* ------------------------------- fidelidade ------------------------------- */

export async function fetchLoyalty(orgId: string) {
  const { data, error } = await supabase.rpc('my_loyalty', { p_org: orgId });
  if (error) throw new Error(error.message);
  return data;
}

export async function redeemLoyalty(orgId: string): Promise<string> {
  const { data, error } = await supabase.rpc('redeem_loyalty_reward', { p_org: orgId });
  if (error) throw new Error(error.message);
  return data as string;
}

/* ---------------------------------- loja ---------------------------------- */

export async function fetchShopProducts(orgId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('org_id', orgId)
    .eq('active', true)
    .eq('show_in_store', true)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as Product[]) ?? [];
}

export async function reserveProduct(
  orgId: string,
  productId: string,
  qty = 1
): Promise<string> {
  const { data, error } = await supabase.rpc('reserve_product', {
    p_org: orgId,
    p_product: productId,
    p_qty: qty,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function fetchMyReservations(orgId: string): Promise<Reservation[]> {
  const { data, error } = await supabase
    .from('product_reservations')
    .select('id, product_id, qty, unit_price, status, note, created_at, product:products(name, image_url)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data as unknown as Reservation[]) ?? [];
}

export async function cancelReservation(id: string): Promise<void> {
  const { error } = await supabase
    .from('product_reservations')
    .update({ status: 'cancelled' })
    .eq('id', id);
  if (error) throw new Error(error.message);
}
