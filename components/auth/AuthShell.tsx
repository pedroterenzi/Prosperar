'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import Link from 'next/link';

/** Moldura compartilhada das telas de auth (mesmo visual do agendamento). */
export function AuthShell({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2 self-start text-secondary">
        <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border bg-surface text-accent">
          {icon}
        </span>
        <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">
          Prosperar
        </span>
      </Link>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="glass-strong p-6"
      >
        <h1 className="text-[22px] font-semibold leading-tight text-primary">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[14px] text-secondary">{subtitle}</p>}
        {children}
      </motion.section>

      <p className="mt-auto pt-8 text-center text-[12px] text-muted">
        Prosperar Club · agendamento, comanda e fidelidade em um só lugar
      </p>
    </main>
  );
}

export function Field({
  icon,
  suffix,
  onChange,
  ...props
}: {
  icon?: ReactNode;
  suffix?: ReactNode;
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
        className={`field ${icon ? 'pl-11' : ''} ${suffix ? 'pr-12' : ''}`}
      />
      {suffix && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2">{suffix}</span>
      )}
    </div>
  );
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'critical' | 'positive';
  children: ReactNode;
}) {
  const cls =
    tone === 'critical'
      ? 'border-critical/40 bg-critical/10 text-critical'
      : tone === 'positive'
        ? 'border-positive/40 bg-positive/10 text-positive'
        : 'border-border bg-surface text-secondary';

  return (
    <p className={`rounded-2xl border px-4 py-3 text-[13px] leading-snug ${cls}`}>{children}</p>
  );
}
