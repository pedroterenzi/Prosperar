'use client';

import { motion, type Variants } from 'framer-motion';
import { Check, Clock, User } from '@phosphor-icons/react';
import { brl } from '@/lib/booking/format';
import type { Service } from '@/lib/booking/types';

type Props = {
  services: Service[];
  selectedServiceId: string | null;
  selectedProfessionalId: string; // 'any' ou um id concreto
  onSelectService: (serviceId: string) => void;
  onSelectProfessional: (professionalId: string) => void;
};

const grid: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const card: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
};

/**
 * Tela 1 — catálogo vivo: entrada escalonada dos cards, hover com elevação,
 * anel dourado que "voa" entre os serviços selecionados (layoutId).
 */
export function ServicePicker({
  services,
  selectedServiceId,
  selectedProfessionalId,
  onSelectService,
  onSelectProfessional,
}: Props) {
  const selected = services.find((s) => s.id === selectedServiceId) ?? null;

  return (
    <div className="space-y-7">
      <section>
        <span className="step-label">1 · Escolha o serviço</span>
        <motion.div
          className="grid grid-cols-2 gap-3"
          variants={grid}
          initial="hidden"
          animate="show"
        >
          {services.map((s) => {
            const isActive = s.id === selectedServiceId;
            return (
              <motion.button
                key={s.id}
                type="button"
                variants={card}
                aria-pressed={isActive}
                whileHover={{ y: -3, scale: 1.015 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                onClick={() => onSelectService(s.id)}
                className="glass relative rounded-2xl p-4 text-left"
              >
                {isActive && (
                  <motion.span
                    layoutId="svc-ring"
                    className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-accent"
                    style={{ boxShadow: 'var(--shadow-gold)' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="block pr-6 text-[15px] font-semibold leading-snug text-primary">
                  {s.name}
                </span>
                <span className="mt-1.5 flex items-center gap-1.5 font-mono text-xs text-muted">
                  <Clock size={12} /> {s.duration_min} min
                </span>
                <span className="mt-2 block font-mono text-lg font-bold text-positive">
                  {brl(s.price)}
                </span>
                {isActive && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.05 }}
                    className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-contrast"
                  >
                    <Check size={12} weight="bold" />
                  </motion.span>
                )}
              </motion.button>
            );
          })}
        </motion.div>
      </section>

      {selected && (
        <section>
          <span className="step-label">2 · Profissional (opcional)</span>
          <div className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <ProfessionalChip
              label="Qualquer"
              initials="*"
              color={null}
              active={selectedProfessionalId === 'any'}
              onClick={() => onSelectProfessional('any')}
            />
            {selected.professionals.map((p) => (
              <ProfessionalChip
                key={p.id}
                label={p.name}
                initials={p.name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
                color={p.color}
                active={selectedProfessionalId === p.id}
                onClick={() => onSelectProfessional(p.id)}
              />
            ))}
          </div>
          <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted">
            <User size={12} /> Sem preferência mostra o primeiro horário livre de qualquer um.
          </p>
        </section>
      )}
    </div>
  );
}

function ProfessionalChip({
  label,
  initials,
  color,
  active,
  onClick,
}: {
  label: string;
  initials: string;
  color: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      aria-pressed={active}
      onClick={onClick}
      className="flex shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-sm font-medium transition"
      style={{
        background: active ? 'var(--accent-soft)' : 'var(--bg-surface)',
        borderColor: active ? 'var(--accent)' : 'var(--border-default)',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
      }}
    >
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full font-mono text-[11px] font-bold"
        style={{
          background: color ?? 'var(--bg-raised)',
          color: color ? '#0b0c0e' : 'var(--text-secondary)',
        }}
      >
        {initials}
      </span>
      {label}
    </motion.button>
  );
}
