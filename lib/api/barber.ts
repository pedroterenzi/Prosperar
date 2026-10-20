import { supabase } from '@/lib/supabase/client';
import type {
  Appointment,
  AppointmentNote,
  AppointmentStatus,
  BarberSummary,
  LostClient,
  Order,
  PaymentMethod,
  Product,
  Professional,
} from './types';

/* -------------------------------- contexto -------------------------------- */

/** Cadeira do usuário logado (professionals.user_id = auth.uid()). */
export async function fetchMyProfessional(): Promise<Professional | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('professionals')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Professional | null) ?? null;
}

/* ---------------------------------- agenda -------------------------------- */

/** Agendamentos de um dia (timezone do aparelho → ISO do intervalo). */
export async function fetchDayAppointments(
  orgId: string,
  professionalId: string | null,
  dayStartIso: string,
  dayEndIso: string
): Promise<Appointment[]> {
  let query = supabase
    .from('appointments')
    .select(
      'id, org_id, customer_id, professional_id, service_id, service_name, service_price, duration_min, start_at, end_at, status, source, customer:customers(full_name, phone, notes), professional:professionals(full_name, color)'
    )
    .eq('org_id', orgId)
    .gte('start_at', dayStartIso)
    .lt('start_at', dayEndIso)
    .order('start_at', { ascending: true });

  if (professionalId) query = query.eq('professional_id', professionalId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as unknown as Appointment[]) ?? [];
}

export async function fetchAppointmentNotes(appointmentId: string): Promise<AppointmentNote[]> {
  const { data, error } = await supabase
    .from('appointment_events')
    .select('id, type, payload, created_at')
    .eq('appointment_id', appointmentId)
    .eq('type', 'note')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as AppointmentNote[]) ?? [];
}

/** Transição de status com as mesmas guardas do banco (invalid_transition). */
export async function setAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus
): Promise<AppointmentStatus> {
  const { data, error } = await supabase.rpc('set_appointment_status', {
    p_appointment: appointmentId,
    p_status: status,
  });
  if (error) throw new Error(error.message);
  return data as AppointmentStatus;
}

export async function addAppointmentNote(
  appointmentId: string,
  text: string,
  photos: string[]
): Promise<void> {
  const { error } = await supabase.rpc('add_appointment_note', {
    p_appointment: appointmentId,
    p_text: text,
    p_photos: photos,
  });
  if (error) throw new Error(error.message);
}

/** Bloqueio rápido: cria time_off para a própria cadeira. */
export async function blockMyTime(
  startIso: string,
  endIso: string,
  reason: string
): Promise<string> {
  const { data, error } = await supabase.rpc('block_my_time', {
    p_start: startIso,
    p_end: endIso,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/* ---------------------------------- comanda ------------------------------- */

/** Comanda aberta do agendamento (cria com o serviço do snapshot). */
export async function openComanda(appointmentId: string): Promise<string> {
  const { data, error } = await supabase.rpc('open_comanda', { p_appointment: appointmentId });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function fetchOrder(orderId: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, status, subtotal, discount, tip, total, items:order_items(id, kind, ref_id, name, qty, unit_price, total)')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as Order | null) ?? null;
}

export async function addComandaItem(
  orderId: string,
  kind: 'service' | 'product',
  refId: string,
  qty = 1
): Promise<number> {
  const { data, error } = await supabase.rpc('add_comanda_item', {
    p_order: orderId,
    p_kind: kind,
    p_ref: refId,
    p_qty: qty,
  });
  if (error) throw new Error(error.message);
  return Number(data);
}

export async function removeComandaItem(itemId: string): Promise<number> {
  const { data, error } = await supabase.rpc('remove_comanda_item', { p_item: itemId });
  if (error) throw new Error(error.message);
  return Number(data);
}

export async function closeComanda(args: {
  orderId: string;
  method: PaymentMethod;
  tip: number;
  discount: number;
}): Promise<{ total: number }> {
  const { data, error } = await supabase.rpc('close_comanda', {
    p_order: args.orderId,
    p_method: args.method,
    p_tip: args.tip,
    p_discount: args.discount,
  });
  if (error) throw new Error(error.message);
  const row = ((data ?? []) as { total: number }[])[0];
  return { total: Number(row?.total ?? 0) };
}

/* -------------------------------- dashboard ------------------------------- */

export async function fetchBarberSummary(
  professionalId: string,
  from: string,
  to: string
): Promise<BarberSummary> {
  const { data, error } = await supabase.rpc('barber_summary', {
    p_professional: professionalId,
    p_from: from,
    p_to: to,
  });
  if (error) throw new Error(error.message);
  return data as BarberSummary;
}

/* --------------------------------- retenção ------------------------------- */

export async function fetchLostClients(orgId: string, days: number): Promise<LostClient[]> {
  const { data, error } = await supabase.rpc('lost_clients', { p_org: orgId, p_days: days });
  if (error) throw new Error(error.message);
  return (data as LostClient[]) ?? [];
}

/* --------------------------- catálogo da comanda --------------------------- */

/** Produtos ativos da organização para somar na comanda. */
export async function fetchComandaCatalog(orgId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('org_id', orgId)
    .eq('active', true)
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as Product[]) ?? [];
}
