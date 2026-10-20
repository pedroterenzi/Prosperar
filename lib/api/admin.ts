import { supabase } from '@/lib/supabase/client';
import type {
  AdminSummary,
  AvailabilityRule,
  Organization,
  Product,
  Professional,
  Service,
} from './types';

/* -------------------------------- contexto -------------------------------- */

/** Organização do usuário logado (RLS: owner/staff do próprio org). */
export async function fetchOrganization(orgId: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, slug, phone, address, timezone, logo_url, settings')
    .eq('id', orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Organization | null) ?? null;
}

export async function updateOrganization(
  orgId: string,
  patch: Partial<Pick<Organization, 'name' | 'phone' | 'address' | 'settings'>>
): Promise<void> {
  const { error } = await supabase.from('organizations').update(patch).eq('id', orgId);
  if (error) throw new Error(error.message);
}

/* ---------------------------------- equipe -------------------------------- */

export async function fetchProfessionals(orgId: string): Promise<Professional[]> {
  const { data, error } = await supabase
    .from('professionals')
    .select('*')
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as Professional[]) ?? [];
}

export async function saveProfessional(
  input: Partial<Professional> & { org_id: string; full_name: string }
): Promise<Professional> {
  if (input.id) {
    const { data, error } = await supabase
      .from('professionals')
      .update(input)
      .eq('id', input.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as Professional;
  }
  const { data, error } = await supabase
    .from('professionals')
    .insert(input)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as Professional;
}

export async function deleteProfessional(id: string): Promise<void> {
  // Marca como inativo: histórico de comissões não pode perder o profissional.
  const { error } = await supabase.from('professionals').update({ active: false }).eq('id', id);
  if (error) throw new Error(error.message);
}

/* --------------------------------- serviços ------------------------------- */

export async function fetchServices(orgId: string): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as Service[]) ?? [];
}

export async function saveService(
  input: Partial<Service> & { org_id: string; name: string }
): Promise<Service> {
  if (input.id) {
    const { data, error } = await supabase
      .from('services')
      .update(input)
      .eq('id', input.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as Service;
  }
  const { data, error } = await supabase.from('services').insert(input).select('*').single();
  if (error) throw new Error(error.message);
  return data as Service;
}

export async function toggleService(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('services').update({ active }).eq('id', id);
  if (error) throw new Error(error.message);
}

/* --------------------------------- produtos ------------------------------- */

export async function fetchProducts(orgId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as Product[]) ?? [];
}

export async function saveProduct(
  input: Partial<Product> & { org_id: string; name: string; price: number }
): Promise<Product> {
  if (input.id) {
    const { data, error } = await supabase
      .from('products')
      .update(input)
      .eq('id', input.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as Product;
  }
  const { data, error } = await supabase.from('products').insert(input).select('*').single();
  if (error) throw new Error(error.message);
  return data as Product;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').update({ active: false }).eq('id', id);
  if (error) throw new Error(error.message);
}

/* ------------------------------- expediente ------------------------------- */

export async function fetchAvailability(orgId: string): Promise<AvailabilityRule[]> {
  const { data, error } = await supabase
    .from('availability_rules')
    .select('*')
    .eq('org_id', orgId);
  if (error) throw new Error(error.message);
  return (data as AvailabilityRule[]) ?? [];
}

/**
 * Troca as regras de expediente de um dia da semana para um escopo
 * (casa toda → professional_id null). Apaga as antigas e grava as novas.
 */
export async function replaceAvailabilityRules(args: {
  orgId: string;
  professionalId: string | null;
  weekday: number;
  windows: { start_time: string; end_time: string }[];
}): Promise<void> {
  const { orgId, professionalId, weekday, windows } = args;

  let del = supabase.from('availability_rules').delete().eq('org_id', orgId).eq('weekday', weekday);
  del = professionalId ? del.eq('professional_id', professionalId) : del.is('professional_id', null);
  const { error: delError } = await del;
  if (delError) throw new Error(delError.message);

  if (windows.length === 0) return;

  const { error: insError } = await supabase.from('availability_rules').insert(
    windows.map((w) => ({
      org_id: orgId,
      professional_id: professionalId,
      weekday,
      start_time: w.start_time,
      end_time: w.end_time,
    }))
  );
  if (insError) throw new Error(insError.message);
}

/* -------------------------------- dashboard ------------------------------- */

export async function fetchAdminSummary(
  orgId: string,
  from: string,
  to: string
): Promise<AdminSummary> {
  const { data, error } = await supabase.rpc('admin_summary', {
    p_org: orgId,
    p_from: from,
    p_to: to,
  });
  if (error) throw new Error(error.message);
  return data as AdminSummary;
}
