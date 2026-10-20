import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { AppRole } from './client';

/**
 * Cliente Supabase para Server Components / Route Handlers.
 * Lê a sessão do cookie (mesma sessão do browser) e permite escrever cookies
 * atualizados quando o token é renovado.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-key',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component sem permissão de escrita: o middleware já renova.
          }
        },
      },
    }
  );
}

export type SessionProfile = {
  id: string;
  org_id: string | null;
  role: AppRole;
  full_name: string;
  email: string | null;
  phone: string | null;
};

/** Perfil + usuário do request atual (null quando não há sessão). */
export async function getSessionUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null as SessionProfile | null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, org_id, role, full_name, email, phone')
    .eq('id', user.id)
    .maybeSingle();

  return { supabase, user, profile: (profile as SessionProfile | null) ?? null };
}
