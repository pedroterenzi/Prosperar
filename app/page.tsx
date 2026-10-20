import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-2xl font-bold text-accent">
        P
      </div>
      <div>
        <h1 className="text-xl font-bold">Prosperar V2</h1>
        <p className="mt-1.5 text-sm text-secondary">
          Tela de agendamento Zero Friction — 3 toques, OTP por WhatsApp, sem senha.
        </p>
      </div>
      <Link href="/b/demo" className="btn-primary">
        Abrir tela de agendamento (demo)
      </Link>
    </main>
  );
}
