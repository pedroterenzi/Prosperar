'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Envelope,
  Lock,
  MapPin,
  Phone,
  Spinner,
  Storefront,
  User,
} from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase/client';
import { AuthShell, Notice } from '@/components/auth/AuthShell';
import { onlyDigits, formatPhoneDigits, toE164 } from '@/lib/booking/format';
import { checkSlug, createBarbershop, slugify } from '@/lib/api/onboarding';

type Step = 0 | 1 | 2;

const stepMotion = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -28 },
  transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
};

/**
 * Onboarding de nova barbearia:
 *   1) conta do gestor (e-mail/senha)  → cria o profile (role=owner, sem org)
 *   2) dados do negócio + slug único   → create_barbershop() cria a org
 *   3) equipe/serviços ficam nas configurações (próximo passo)
 *
 * Se o usuário já está logado sem org (voltou ao fluxo), pulamos a etapa 1.
 */
export default function SignupBarbershopPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [checking, setChecking] = useState(true);

  // conta
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // negócio
  const [shopName, setShopName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugState, setSlugState] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Usuário já autenticado (sem org) entra direto na etapa do negócio. */
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email ?? '');
        setStep(1);
      }
      setChecking(false);
    })();
  }, []);

  /* Slug automático a partir do nome, até o usuário mexer no campo. */
  useEffect(() => {
    if (!slugEdited) setSlug(slugify(shopName));
  }, [shopName, slugEdited]);

  /* Validação do slug com debounce (unicidade real no banco). */
  useEffect(() => {
    if (step !== 1 || slug.length < 3) {
      setSlugState('idle');
      return;
    }
    let alive = true;
    setSlugState('checking');
    const t = setTimeout(async () => {
      try {
        const free = await checkSlug(slug);
        if (alive) setSlugState(free ? 'free' : 'taken');
      } catch {
        if (alive) setSlugState('idle');
      }
    }, 420);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [slug, step]);

  const address = useMemo(
    () => ({ street: street.trim(), city: city.trim() }),
    [street, city]
  );

  /* ------------------------------- etapa 1 -------------------------------- */
  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (password.length < 6) throw new Error('weak_password');

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { role: 'owner', full_name: fullName.trim() || 'Gestor' },
        },
      });
      if (signUpError) throw new Error(signUpError.message);

      // Com "Confirm email" ligado não há sessão: avisamos para confirmar.
      if (!data.session) {
        setError('env:confirm');
        return;
      }
      setStep(1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(
        msg === 'weak_password'
          ? 'A senha precisa ter ao menos 6 caracteres.'
          : /already registered/i.test(msg)
            ? 'Esse e-mail já tem conta. Faça login e volte ao onboarding.'
            : 'Não foi possível criar a conta. Tente novamente.'
      );
    } finally {
      setBusy(false);
    }
  }

  /* ------------------------------- etapa 2 -------------------------------- */
  async function handleCreateShop(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (shopName.trim().length < 3) throw new Error('invalid_name');
      if (slugState === 'taken') throw new Error('slug_unavailable');

      await createBarbershop({
        name: shopName.trim(),
        slug,
        phone: phoneDigits.length >= 10 ? toE164(phoneDigits) : null,
        address,
      });

      router.replace('/app/admin/settings');
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(
        msg.includes('slug_unavailable')
          ? 'Esse link já está em uso. Escolha outro.'
          : msg === 'invalid_name'
            ? 'Informe o nome da barbearia (mín. 3 letras).'
            : 'Não foi possível criar a barbearia. Tente novamente.'
      );
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <AuthShell icon={<Storefront size={22} weight="duotone" />} title="Preparando...">
        <div className="mt-6 h-64 skeleton" />
      </AuthShell>
    );
  }

  /* Confirmação de e-mail pendente */
  if (error === 'env:confirm') {
    return (
      <AuthShell
        icon={<Storefront size={22} weight="duotone" />}
        title="Confirme seu e-mail"
        subtitle="Falta um clique para liberar o cadastro da sua barbearia."
      >
        <div className="mt-5 space-y-4">
          <Notice tone="positive">
            Enviamos um link para <b>{email}</b>. Depois de confirmar, entre e continue o
            cadastro do negócio.
          </Notice>
          <Link href="/auth/login" className="btn-primary">
            Já confirmei, entrar
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      icon={<Storefront size={22} weight="duotone" />}
      title="Cadastre sua barbearia"
      subtitle={step === 0 ? 'Passo 1 de 2 · sua conta de gestor' : 'Passo 2 de 2 · o negócio'}
    >
      {/* progresso */}
      <div className="mt-5 flex items-center gap-2">
        {[0, 1].map((i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition ${
              step >= i ? 'bg-accent' : 'bg-surface border border-border'
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 ? (
          <motion.form
            key="account"
            {...stepMotion}
            onSubmit={handleCreateAccount}
            className="mt-6 space-y-4"
          >
            <Input
              icon={<User size={18} weight="duotone" />}
              placeholder="Seu nome completo"
              value={fullName}
              onChange={setFullName}
              required
            />
            <Input
              icon={<Envelope size={18} weight="duotone" />}
              type="email"
              placeholder="voce@email.com"
              value={email}
              onChange={setEmail}
              required
            />
            <Input
              icon={<Lock size={18} weight="duotone" />}
              type="password"
              placeholder="Senha (mín. 6 caracteres)"
              value={password}
              onChange={setPassword}
              required
            />

            {error && error !== 'env:confirm' && <Notice tone="critical">{error}</Notice>}

            <button className="btn-primary" disabled={busy}>
              {busy ? <Spinner size={18} className="animate-spin" /> : (
                <>
                  Continuar <ArrowRight size={18} weight="bold" />
                </>
              )}
            </button>
          </motion.form>
        ) : (
          <motion.form
            key="shop"
            {...stepMotion}
            onSubmit={handleCreateShop}
            className="mt-6 space-y-4"
          >
            <Input
              icon={<Storefront size={18} weight="duotone" />}
              placeholder="Nome da barbearia"
              value={shopName}
              onChange={setShopName}
              required
            />

            <div>
              <label className="step-label">Link público</label>
              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap text-[13px] text-muted">/b/</span>
                <input
                  className="field"
                  placeholder="sua-barbearia"
                  value={slug}
                  onChange={(e) => {
                    setSlugEdited(true);
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                  }}
                  required
                />
              </div>
              <div className="mt-1.5 min-h-[18px] text-[12px]">
                {slugState === 'checking' && <span className="text-muted">Verificando…</span>}
                {slugState === 'free' && (
                  <span className="inline-flex items-center gap-1 text-positive">
                    <Check size={13} weight="bold" /> Disponível
                  </span>
                )}
                {slugState === 'taken' && (
                  <span className="text-critical">Indisponível — escolha outro</span>
                )}
                {slugState === 'idle' && (
                  <span className="text-muted">É o endereço onde seus clientes agendam.</span>
                )}
              </div>
            </div>

            <Input
              icon={<Phone size={18} weight="duotone" />}
              inputMode="tel"
              placeholder="WhatsApp da barbearia"
              value={formatPhoneDigits(phoneDigits)}
              onChange={(v) => setPhoneDigits(onlyDigits(v))}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                icon={<MapPin size={18} weight="duotone" />}
                placeholder="Rua e número"
                value={street}
                onChange={setStreet}
              />
              <Input
                placeholder="Cidade"
                value={city}
                onChange={setCity}
              />
            </div>

            {error && <Notice tone="critical">{error}</Notice>}

            <div className="flex gap-3">
              <button
                type="button"
                className="btn-glass w-auto px-5"
                onClick={() => setStep(0)}
                aria-label="Voltar"
              >
                <ArrowLeft size={18} weight="bold" />
              </button>
              <button className="btn-primary" disabled={busy || slugState === 'taken'}>
                {busy ? <Spinner size={18} className="animate-spin" /> : 'Criar minha barbearia'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <p className="mt-6 text-center text-[13px] text-secondary">
        Já tem uma conta?{' '}
        <Link href="/auth/login" className="font-semibold text-accent">
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}

function Input({
  icon,
  onChange,
  ...props
}: {
  icon?: React.ReactNode;
  onChange?: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>) {
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
          {icon}
        </span>
      )}
      <input
        {...props}
        onChange={(e) => onChange?.(e.target.value)}
        className={`field ${icon ? 'pl-11' : ''}`}
      />
    </div>
  );
}
