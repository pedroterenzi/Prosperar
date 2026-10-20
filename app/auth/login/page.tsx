'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Envelope, Eye, EyeSlash, Scissors, Spinner } from '@phosphor-icons/react';
import { HOME_BY_ROLE, supabase, type AppRole } from '@/lib/supabase/client';
import { AuthShell, Field, Notice } from '@/components/auth/AuthShell';

/**
 * Login em duas vias:
 *   • senha (e-mail)     → uso diário de barbeiro/ADM
 *   • Magic Link (e-mail) → sem senha, um clique no link
 */
function SignInInner() {
  const router = useRouter();
  const params = useSearchParams();
  const nextParam = params.get('next');
  const linkError = params.get('error');

  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    linkError === 'link_expirado' ? 'O link expirou. Tente novamente.' : null
  );
  const [sent, setSent] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  async function resolveHome(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('role, org_id')
      .eq('id', userId)
      .maybeSingle();

    if (!data?.org_id) return '/auth/signup-barbershop';
    return HOME_BY_ROLE[(data.role as AppRole) ?? 'client'] ?? '/app';
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw new Error(signInError.message);
      if (!data.user) throw new Error('empty_session');
      router.replace(nextParam || (await resolveHome(data.user.id)));
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(
        /invalid login/i.test(msg)
          ? 'E-mail ou senha incorretos.'
          : /email not confirmed/i.test(msg)
            ? 'Confirme o e-mail antes de entrar (verifique a caixa de entrada).'
            : 'Não foi possível entrar. Tente novamente.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleMagic(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            nextParam || '/app'
          )}`,
        },
      });
      if (otpError) throw new Error(otpError.message);
      setMagicSent(true);
    } catch {
      setError('Não foi possível enviar o link. Confira o e-mail informado.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-6 space-y-4 text-center">
        <p className="text-[15px] text-primary">
          Conta criada! Enviamos um link de confirmação para{' '}
          <span className="font-semibold">{email}</span>.
        </p>
        <p className="text-[13px] text-muted">
          Confirme o e-mail e depois volte para entrar.
        </p>
        <button className="btn-glass" onClick={() => setSent(false)}>
          Voltar
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 flex rounded-2xl border border-border p-1 text-[13px] font-semibold">
        {(['password', 'magic'] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`flex-1 rounded-xl py-2.5 transition ${
              mode === m ? 'bg-accent text-accent-contrast' : 'text-secondary'
            }`}
          >
            {m === 'password' ? 'E-mail e senha' : 'Link mágico'}
          </button>
        ))}
      </div>

      <form onSubmit={mode === 'password' ? handlePassword : handleMagic} className="mt-6 space-y-4">
        <Field
          icon={<Envelope size={18} weight="duotone" />}
          type="email"
          placeholder="voce@email.com"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          required
        />

        {mode === 'password' && (
          <Field
            type={showPass ? 'text' : 'password'}
            placeholder="Sua senha"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            required
            suffix={
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="text-muted transition hover:text-primary"
                aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPass ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            }
          />
        )}

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Notice tone="critical">{error}</Notice>
            </motion.div>
          )}
          {magicSent && !error && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Notice tone="positive">
                Link enviado. Abra o e-mail <span className="font-semibold">{email}</span> para entrar.
              </Notice>
            </motion.div>
          )}
        </AnimatePresence>

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? (
            <Spinner size={18} className="animate-spin" />
          ) : mode === 'password' ? (
            'Entrar'
          ) : (
            'Enviar link de acesso'
          )}
        </button>
      </form>

      <div className="mt-6 space-y-2 text-center text-[13px] text-secondary">
        <p>
          Não tem conta?{' '}
          <Link href="/auth/sign-up" className="font-semibold text-accent">
            Criar agora
          </Link>
        </p>
        <p>
          Tem uma barbearia?{' '}
          <Link href="/auth/signup-barbershop" className="font-semibold text-accent">
            Cadastre seu negócio
          </Link>
        </p>
        <p className="pt-2">
          <Link href="/b/demo" className="text-muted underline-offset-4 hover:underline">
            Agendar sem login →
          </Link>
        </p>
      </div>
    </>
  );
}

export default function SignInPage() {
  return (
    <AuthShell
      icon={<Scissors size={22} weight="duotone" />}
      title="Bem-vindo de volta"
      subtitle="Entre para gerenciar sua agenda, comandas e clientes."
    >
      <Suspense fallback={<div className="mt-6 h-40 skeleton" />}>
        <SignInInner />
      </Suspense>
    </AuthShell>
  );
}
