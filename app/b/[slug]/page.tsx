import BookingFlow from '@/components/booking/BookingFlow';

/**
 * Rota pública de agendamento por organização.
 * /b/demo → org com slug "demo" (criada pela migration 0004_demo_seed.sql)
 *
 * `?service=<uuid>` pré-seleciona o serviço — usado pelo botão
 * "Repetir agendamento" da área do cliente (1 clique).
 */
export default function BookingPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { service?: string };
}) {
  const service = typeof searchParams.service === 'string' ? searchParams.service : null;
  return <BookingFlow slug={params.slug} initialServiceId={service} />;
}
