import { supabase } from '@/lib/supabase/client';
import type {
  BookingResult,
  CatalogRow,
  MyAppointment,
  Org,
  Professional,
  Service,
  Slot,
} from './types';

/* -------------------------------------------------------------------------- */
/*  Catálogo (tabela services/professionals — via RPC pública, anônimo ok)     */
/* -------------------------------------------------------------------------- */

export async function fetchOrgBySlug(slug: string): Promise<Org | null> {
  const { data, error } = await supabase.rpc('get_org_by_slug', { p_slug: slug });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Org[])[0] ?? null;
}

/** get_public_catalog devolve serviço × profissional; agregamos por serviço. */
export async function fetchCatalog(orgId: string): Promise<Service[]> {
  const { data, error } = await supabase.rpc('get_public_catalog', { p_org: orgId });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as CatalogRow[];
  const byService = new Map<string, Service>();

  for (const r of rows) {
    let svc = byService.get(r.service_id);
    if (!svc) {
      svc = {
        id: r.service_id,
        name: r.service_name,
        duration_min: r.duration_min,
        price: r.price,
        professionals: [],
      };
      byService.set(r.service_id, svc);
    }
    if (!svc.professionals.some((p) => p.id === r.professional_id)) {
      svc.professionals.push({
        id: r.professional_id,
        name: r.professional_name,
        color: r.professional_color,
      });
    }
  }
  return [...byService.values()];
}

/* -------------------------------------------------------------------------- */
/*  Agenda (get_available_slots — lê availability_rules/time_off/appts)        */
/* -------------------------------------------------------------------------- */

type SlotRow = { slot_start: string };

/**
 * Horários livres num dia. Com "Qualquer profissional" fazemos uma chamada por
 * profissional em paralelo e unificamos por horário (fica o 1º que atende).
 */
export async function fetchSlotsFor(args: {
  orgId: string;
  professionals: Professional[];
  durationMin: number;
  date: string; // 'yyyy-mm-dd'
}): Promise<Slot[]> {
  const { orgId, professionals, durationMin, date } = args;

  const results = await Promise.all(
    professionals.map(async (pro) => {
      const { data, error } = await supabase.rpc('get_available_slots', {
        p_org: orgId,
        p_professional: pro.id,
        p_date: date,
        p_duration_min: durationMin,
      });
      if (error) throw new Error(error.message);
      return ((data ?? []) as SlotRow[]).map((row) => ({
        start: row.slot_start,
        professional_id: pro.id,
      }));
    })
  );

  const byStart = new Map<string, Slot>();
  for (const list of results) {
    for (const slot of list) {
      if (!byStart.has(slot.start)) byStart.set(slot.start, slot);
    }
  }
  return [...byStart.values()].sort((a, b) => a.start.localeCompare(b.start));
}

/* -------------------------------------------------------------------------- */
/*  Agendamento (tabela appointments — via RPC book_appointment)               */
/* -------------------------------------------------------------------------- */

export async function bookAppointment(args: {
  orgId: string;
  serviceId: string;
  professionalId: string;
  startAt: string; // ISO vindo de get_available_slots
  phone: string; // E.164 do celular verificado por OTP
  fullName?: string;
}): Promise<BookingResult> {
  const { data, error } = await supabase.rpc('book_appointment', {
    p_org: args.orgId,
    p_service_id: args.serviceId,
    p_professional_id: args.professionalId,
    p_start_at: args.startAt,
    p_phone: args.phone,
    p_full_name: args.fullName ?? null,
  });
  if (error) throw new Error(error.message); // 'slot_unavailable' | 'auth_required' | ...

  const row = ((data ?? []) as { appointment_id: string; reschedule_token: string }[])[0];
  if (!row) throw new Error('empty_response');
  return { id: row.appointment_id, token: row.reschedule_token };
}

/** Leitura direta de appointments — RLS garante que cada cliente vê as suas. */
export async function fetchMyAppointments(orgId: string): Promise<MyAppointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, start_at, status, service_name, professional:professionals(full_name)')
    .eq('org_id', orgId)
    .gte('start_at', new Date().toISOString())
    .order('start_at', { ascending: true })
    .limit(5);

  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    start_at: string;
    status: string;
    service_name: string;
    professional: { full_name: string } | null;
  };
  return (data as unknown as Row[]).map((r) => ({
    id: r.id,
    start_at: r.start_at,
    status: r.status,
    service_name: r.service_name,
    pro_name: r.professional?.full_name ?? null,
  }));
}

/* -------------------------------------------------------------------------- */
/*  Identidade por OTP — sem senha, sessão persistente no aparelho             */
/* -------------------------------------------------------------------------- */

export async function sendOtp(phone: string, orgId: string, fullName?: string) {
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: {
      // Vai para raw_user_meta_data → trigger handle_new_user cria o profile
      // com org_id e role='client' (banco: supabase/migrations/0002).
      data: { org_id: orgId, role: 'client', full_name: fullName || 'Cliente' },
    },
  });
  if (error) throw new Error(error.message);
}

export async function verifyOtp(phone: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) throw new Error(error.message);
}
