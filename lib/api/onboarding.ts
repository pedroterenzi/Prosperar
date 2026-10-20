import { supabase } from '@/lib/supabase/client';

/** 'Minha Barbearia!' → 'minha-barbearia' (mesma regra do banco). */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Slug livre? (unicidade verificada no banco, não no cliente). */
export async function checkSlug(slug: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_slug_available', { p_slug: slug });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/**
 * Cria a organização e promove o usuário logado a owner.
 * Requer sessão ativa — o RPC é SECURITY DEFINER e checa auth.uid().
 */
export async function createBarbershop(input: {
  name: string;
  slug: string;
  phone: string | null;
  address: { street?: string; city?: string };
}): Promise<{ org_id: string; slug: string }> {
  const { data, error } = await supabase.rpc('create_barbershop', {
    p_name: input.name,
    p_slug: input.slug,
    p_phone: input.phone,
    p_address: input.address,
  });
  if (error) throw new Error(error.message);

  const row = ((data ?? []) as { org_id: string; slug: string }[])[0];
  if (!row) throw new Error('empty_response');
  return row;
}
