'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarBlank,
  ChartBar,
  Gift,
  Heart,
  Storefront,
  Gear,
  Package,
  SignOut,
  Scissors,
  UserCircle,
} from '@phosphor-icons/react';
import { supabase, type AppRole } from '@/lib/supabase/client';

type NavItem = { href: string; label: string; icon: React.ReactNode };

const NAV: Record<'admin' | 'barber' | 'client', NavItem[]> = {
  admin: [
    { href: '/app/admin/dashboard', label: 'Visão geral', icon: <ChartBar size={20} weight="duotone" /> },
    { href: '/app/admin/products', label: 'Produtos', icon: <Package size={20} weight="duotone" /> },
    { href: '/app/admin/settings', label: 'Ajustes', icon: <Gear size={20} weight="duotone" /> },
  ],
  barber: [
    { href: '/app/barber/agenda', label: 'Agenda', icon: <CalendarBlank size={20} weight="duotone" /> },
    { href: '/app/barber/dashboard', label: 'Ganhos', icon: <ChartBar size={20} weight="duotone" /> },
    { href: '/app/barber/retention', label: 'Clientes', icon: <Heart size={20} weight="duotone" /> },
  ],
  client: [
    { href: '/app/client/history', label: 'Histórico', icon: <Scissors size={20} weight="duotone" /> },
    { href: '/app/client/loyalty', label: 'Fidelidade', icon: <Gift size={20} weight="duotone" /> },
    { href: '/app/client/shop', label: 'Loja', icon: <Storefront size={20} weight="duotone" /> },
  ],
};

export type ShellUser = {
  name: string;
  email: string;
  role: AppRole;
  orgName: string;
  orgSlug: string | null;
  hasOrg: boolean;
};

function sectionFor(role: AppRole): 'admin' | 'barber' | 'client' {
  if (role === 'owner' || role === 'receptionist') return 'admin';
  if (role === 'barber') return 'barber';
  return 'client';
}

/**
 * Casca dos módulos autenticados: sidebar no desktop, tab bar no mobile.
 * O papel define o menu — a autorização real está no middleware + RLS.
 */
export default function AppShell({
  children,
  title,
  subtitle,
  action,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<ShellUser | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, role, org_id, organizations(name, slug)')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!alive || !profile) return;

      type OrgJoin = { name: string; slug: string } | null;
      const org = (profile as unknown as { organizations: OrgJoin }).organizations;

      setUser({
        name: profile.full_name ?? 'Você',
        email: profile.email ?? authUser.email ?? '',
        role: (profile.role as AppRole) ?? 'client',
        orgName: org?.name ?? 'Sem barbearia',
        orgSlug: org?.slug ?? null,
        hasOrg: Boolean(profile.org_id),
      });
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/auth/login');
    router.refresh();
  }

  const section = user ? sectionFor(user.role) : 'client';
  const nav = NAV[section];
  const initials = (user?.name ?? '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl">
      {/* ── sidebar (desktop) ────────────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border px-4 py-6 lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-2">
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border bg-surface text-accent">
            <Scissors size={20} weight="duotone" />
          </span>
          <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
            {user?.orgName ?? 'Prosperar'}
          </span>
        </Link>

        <nav className="mt-8 space-y-1">
          {nav.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[14px] font-medium transition ${
                  active ? 'text-accent' : 'text-secondary hover:text-primary'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-2xl border border-accent/30 bg-accent-soft"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative">{item.icon}</span>
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          {user?.orgSlug && (
            <Link href={`/b/${user.orgSlug}`} className="btn-glass !py-2.5 !text-[13px]">
              <Storefront size={16} weight="duotone" /> Ver página pública
            </Link>
          )}
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-bold text-accent">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-primary">{user?.name ?? '—'}</p>
              <p className="truncate text-[11px] text-muted">{user?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              aria-label="Sair"
              className="text-muted transition hover:text-critical"
            >
              <SignOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── conteúdo ────────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col pb-24 lg:pb-0">
        <header className="sticky top-0 z-20 border-b border-border bg-base/70 px-5 py-4 backdrop-blur-xl lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-[19px] font-semibold text-primary">{title}</h1>
              {subtitle && <p className="truncate text-[13px] text-secondary">{subtitle}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {action}
              <button
                onClick={handleSignOut}
                aria-label="Sair"
                className="grid h-10 w-10 place-items-center rounded-2xl border border-border bg-surface text-muted transition hover:text-critical lg:hidden"
              >
                <SignOut size={18} />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-5 py-6 lg:px-8">{children}</main>
      </div>

      {/* ── tab bar (mobile) ────────────────────────────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-base/85 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {nav.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-medium transition ${
                  active ? 'text-accent' : 'text-muted'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
          {!user?.hasOrg && (
            <Link
              href="/auth/signup-barbershop"
              className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-medium text-muted"
            >
              <UserCircle size={20} weight="duotone" />
              Ativar
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}

/** Atalho visual para telas em que ainda não há dados. */
export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="glass flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-surface text-accent">
        {icon}
      </span>
      <p className="text-[15px] font-semibold text-primary">{title}</p>
      {hint && <p className="max-w-xs text-[13px] text-secondary">{hint}</p>}
      {action}
    </div>
  );
}

/** Wrapper de seção com título (padrão das telas de gestão). */
export function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-strong overflow-hidden">
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-primary">{title}</h2>
          {description && <p className="mt-0.5 text-[12.5px] text-secondary">{description}</p>}
        </div>
        {action}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}
