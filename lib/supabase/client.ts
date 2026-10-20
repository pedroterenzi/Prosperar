import { createBrowserClient } from '@supabase/ssr';

/**
 * Cliente browser único do app (Supabase Auth via cookies).
 *
 * Usamos createBrowserClient (@supabase/ssr) em vez de createClient para que a
 * MESMA sessão valha no cliente e no servidor: o middleware lê o cookie, então
 * quem entra por OTP no /b/[slug] também enxerga /app/client.
 *
 * O cookie guarda a sessão por 400 dias (padrão do SSR client) — mobile-first.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-key';

export const supabase = createBrowserClient(url, anonKey);

/** Roles do enum public.app_role (schema 0001). */
export type AppRole = 'owner' | 'barber' | 'receptionist' | 'client';

/** Rota inicial de cada papel — usada no login, no middleware e no app index. */
export const HOME_BY_ROLE: Record<AppRole, string> = {
  owner: '/app/admin/dashboard',
  receptionist: '/app/admin/dashboard',
  barber: '/app/barber/agenda',
  client: '/app/client/history',
};
