import { supabase } from '@/lib/supabase/client';

/**
 * org_id do usuário logado — base de todas as telas autenticadas.
 * (O RLS já limita o UPDATE/SELECT; aqui é só o contexto.)
 */
export async function getMyOrgId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .maybeSingle();

  return (data?.org_id as string | null) ?? null;
}

/** Perfil + org do usuário (nome da loja, slug, papel). */
export async function getMyProfile() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('id, org_id, role, full_name, email, phone, organizations(name, slug)')
    .eq('id', user.id)
    .maybeSingle();

  return data;
}
