'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Envelope, Lock, Spinner, User } from '@phosphor-icons/react';
import { HOME_BY_ROLE, supabase, type AppRole } from '@/lib/supabase/client';
import { AuthShell, Field, Notice } from '@/components/auth/AuthShell';
import { fetchOrgBySlug } from '@/lib/booking/api';

/**
 * Cadastro do cliente final (e do barbeiro convidado).
 * A barbearia é identificada pelo slug; o org_id vai em raw_user_meta_data e o
 * trigger handle_new_user cria o profile já no tenant certo.
 */
function SignUpInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [slug, setSlug] = useState(params.get('org') ?? '');
  const [role, setRole] = useState<'client' | 'barber'>('client');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const fromStorage = window.localStorage.getItem('prosperar:lastOrgSlug');
    if (fromStorage && !slug) setSlug(fromStorage);
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (password.length < 6) throw new Error('weak_password');

      const org = await fetchOrgBySlug(slug.trim().toLowerCase());
      if (!org) throw new Error('org_not_found');

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            HOME_BY_ROLE[role as AppRole]
          )}`,
          data: { org_id: org.id, role, full_name: fullName.trim() || 'Cliente' },
        },
      });
      if (signUpError) throw new Error(signUpError.message);

      window.localStorage.setItem('prosperar:lastOrgSlug', slug.trim().toLowerCase());

      // Sem confirmação de e-mail o Supabase já devolve sessão: entra direto.
      if (data.session) {
        router.replace(HOME_BY_ROLE[role as AppRole]);
        router.refresh();
        return;
      }
      setDone(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(
        msg === 'org_not_found'
          ? 'Não encontramos essa barbearia. Confira o código informado.'
          : msg === 'weak_password'
            ? 'A senha precisa ter ao menos 6 caracteres.'
            : /already registered/i.test(msg)
              ? 'Esse e-mail já tem conta. Faça login.'
              : 'Não foi possível criar a conta. Tente novamente.'
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 space-y-4 text-center">
        <Notice tone="positive">
          Conta criada! Enviamos um link de confirmação para <b>{email}</b>.
        </Notice>
        <Link href="/auth/login" className="btn-primary">
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <Field
        icon={<User size={18} weight="duotone" />}
        placeholder="Seu nome"
        autoComplete="name"
        value={fullName}
        onChange={setFullName}
        required
      />
      <Field
        icon={<Envelope size={18} weight="duotone" />}
        type="email"
        placeholder="voce@email.com"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        required
      />
      <Field
        icon={<Lock size={18} weight="duotone" />}
        type="password"
        placeholder="Senha (mín. 6 caracteres)"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        required
      />

      <div>
        <label className="step-label">Código da barbearia</label>
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-[13px] text-muted">/b/</span>
          <input
            className="field"
            placeholder="demo"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            required
          />
        </div>
        <p className="mt-1.5 text-[12px] text-muted">
          Aparece no fim do link de agendamento da sua barbearia.
        </p>
      </div>

      <div className="flex rounded-2xl border border-border p-1 text-[13px] font-semibold">
        {(['client', 'barber'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`flex-1 rounded-xl py-2.5 transition ${
              role === r ? 'bg-accent text-accent-contrast' : 'text-secondary'
            }`}
          >
            {r === 'client' ? 'Sou cliente' : 'Sou profissional'}
          </button>
        ))}
      </div>

      {error && <Notice tone="critical">{error}</Notice>}

      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? <Spinner size={18} className="animate-spin" /> : 'Criar conta'}
      </button>

      <p className="text-center text-[13px] text-secondary">
        Já tem conta?{' '}
        <Link href="/auth/login" className="font-semibold text-accent">
          Entrar
        </Link>
      </p>
    </form>
  );
}

export default function SignUpPage() {
  return (
    <AuthShell
      icon={<User size={22} weight="duotone" />}
      title="Criar sua conta"
      subtitle="Acesse seu histórico, fidelidade e a loja da barbearia."
    >
      <Suspense fallback={<div className="mt-6 h-72 skeleton" />}>
        <SignUpInner />
      </Suspense>
    </AuthShell>
  );
}
