/** Helpers de formatação pt-BR (nada de libs de data nessa etapa). */

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export const brl = (value: number) => brlFormatter.format(value);

/** 'yyyy-mm-dd' da data local (fuso do aparelho). */
export function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Constrói Date local a partir de 'yyyy-mm-dd' (evita o shift UTC do new Date(str)). */
export function dateFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** '14:30' a partir de um ISO timestamptz (no fuso do aparelho). */
export function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 'sexta-feira, 23/10' */
export function dateLabelLong(key: string): string {
  return `${dateFromKey(key).toLocaleDateString('pt-BR', { weekday: 'long' })}, ${dateFromKey(
    key
  ).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
}

/** '11987654321' → '(11) 98765-4321' */
export function formatPhoneDigits(digits: string): string {
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (rest.length <= 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5, 9)}`;
}

/** '11987654321' → '+5511987654321' (E.164, exigido pelo banco) */
export const toE164 = (digits: string) => `+55${digits}`;

export const onlyDigits = (v: string) => v.replace(/\D/g, '');
