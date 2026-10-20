import { redirect } from 'next/navigation';

/**
 * Rota legada: /auth/sign-in → /auth/login (mantida para links antigos).
 * Preserva ?next= para não perder o destino pedido pelo middleware.
 */
export default function LegacySignIn({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  const query = new URLSearchParams();
  if (searchParams.next) query.set('next', searchParams.next);
  if (searchParams.error) query.set('error', searchParams.error);

  const qs = query.toString();
  redirect(`/auth/login${qs ? `?${qs}` : ''}`);
}
