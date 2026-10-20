import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';

/**
 * /app → manda cada papel para o seu painel (ou para o onboarding,
 * quando o owner ainda não criou a barbearia).
 */
export default async function AppIndex() {
  const { user, profile } = await getSessionUser();

  if (!user) redirect('/auth/login');
  if (!profile?.org_id) redirect('/auth/signup-barbershop');

  switch (profile.role) {
    case 'owner':
    case 'receptionist':
      redirect('/app/admin/dashboard');
    case 'barber':
      redirect('/app/barber/agenda');
    default:
      redirect('/app/client/history');
  }
}
