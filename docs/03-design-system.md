# SaaS V2 — Design System "Atelier" (Premium Dark-First)

> Personalidade: **sofisticação sóbria** — grafite profundo, ouro fosco, tipografia tabular. Nada de neon, nada de gradientes arco-íris. Inspiração: relógio suíço × app de banco digital.

---

## 1. Tokens de Cor

### Dark (default)
```css
:root[data-theme="dark"] {
  /* Superfícies — escada grafite com matiz levemente frio */
  --bg-base:          #0B0C0E;  /* fundo de app */
  --bg-surface:       #141619;  /* cards */
  --bg-raised:        #1C1F23;  /* cards elevados, sheets, modais */
  --bg-inset:         #0E1013;  /* inputs, células de tabela */

  /* Bordas e divisores */
  --border-subtle:    #22252A;  /* divisores internos */
  --border-default:   #2C3037;  /* borda de card */
  --border-strong:    #3A3F47;  /* hover/focus secundário */

  /* Texto */
  --text-primary:     #F4F5F7;
  --text-secondary:   #A6ACB6;
  --text-muted:       #6E7580;
  --text-inverse:     #0B0C0E;  /* texto sobre ouro */

  /* Acento — OURO FOSCO (nunca #FFD700 puro) */
  --accent:           #C9A227;
  --accent-hover:     #D9B23C;
  --accent-press:     #B08F1E;
  --accent-soft:      rgba(201, 162, 39, 0.12);  /* fundos de seleção */
  --accent-contrast:  #0B0C0E;  /* texto em cima do ouro */

  /* Semânticas */
  --positive:         #34D399;  --positive-soft: rgba(52, 211, 153, 0.12);
  --critical:         #F87171;  --critical-soft: rgba(248, 113, 113, 0.12);
  --warning:          #FBBF24;  --warning-soft:  rgba(251, 191, 36, 0.12);
  --info:             #60A5FA;  --info-soft:     rgba(96, 165, 250, 0.12);

  /* Gráficos (ordem de série) */
  --chart-1: #C9A227; --chart-2: #34D399; --chart-3: #60A5FA;
  --chart-4: #A78BFA; --chart-5: #F87171;

  /* Efeitos */
  --shadow-card:      0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35);
  --shadow-float:     0 24px 48px rgba(0,0,0,.55);
  --scrim:            rgba(0, 0, 0, 0.72);
}
```

### Light
```css
:root[data-theme="light"] {
  --bg-base:          #FAF9F7;  /* off-white quente */
  --bg-surface:       #FFFFFF;
  --bg-raised:        #FFFFFF;
  --bg-inset:         #F1EFEB;
  --border-subtle:    #EBE8E3;
  --border-default:   #E0DCD5;
  --border-strong:    #C9C4BA;
  --text-primary:     #17181A;
  --text-secondary:   #5C6169;
  --text-muted:       #8A9099;
  --accent:           #8A6D12;  /* ouro escuro p/ contraste AA em texto */
  --accent-hover:     #755C0E;
  --accent-soft:      rgba(138, 109, 18, 0.10);
  --accent-contrast:  #FFFFFF;
  --positive: #059669; --critical: #DC2626; --warning: #D97706; --info: #2563EB;
  --shadow-card:      0 1px 2px rgba(23,24,26,.06), 0 8px 24px rgba(23,24,26,.06);
  --shadow-float:     0 24px 48px rgba(23,24,26,.14);
  --scrim:            rgba(23, 24, 26, 0.40);
}
```

**Regras de contraste:** todo texto de corpo ≥ 4.5:1 (WCAG AA). Ouro em dark nunca carrega texto branco por cima — usar `--accent-contrast` (preto). Estados não dependem só de cor: sempre cor + ícone/label.

---

## 2. Tipografia

- **Interface:** `Geist` (fallback `Inter`) — variável, ótima em telas pequenas.
- **Números monetários e horários:** `Geist Mono` / `JetBrains Mono` com `font-variant-numeric: tabular-nums` — colunas de dinheiro sempre alinhadas.

```css
--font-sans: 'Geist', 'Inter', -apple-system, sans-serif;
--font-mono: 'Geist Mono', 'JetBrains Mono', monospace;

/* Escala modular 1.25 */
--text-xs:   12px / 16px;   /* badges, metadados */
--text-sm:   14px / 20px;   /* apoio, labels */
--text-base: 16px / 24px;   /* corpo, inputs (16px evita zoom no iOS) */
--text-lg:   20px / 28px;   /* títulos de card */
--text-xl:   25px / 32px;   /* títulos de seção */
--text-2xl:  31px / 40px;   /* KPI values, hero */

--tracking-display: -0.02em;  /* números grandes e títulos */
--tracking-label:    0.06em;  /* labels caps de KPI */
```

**Hierarquia:** KPI values sempre `--text-2xl` mono + tracking display. Labels de KPI: `--text-xs` caps + `--tracking-label` + `--text-muted`.

---

## 3. Espaçamento, Raio e Layout

```css
/* Espaçamento: escala 4px */
--space-1: 4px;   --space-2: 8px;   --space-3: 12px;  --space-4: 16px;
--space-5: 20px;  --space-6: 24px;  --space-8: 32px;  --space-10: 40px;
--space-12: 48px; --space-16: 64px;

/* Raio: quanto maior o elevated, mais "pill" */
--radius-sm: 8px;    /* badges, tags */
--radius-md: 12px;   /* inputs, botões */
--radius-lg: 16px;   /* cards */
--radius-xl: 24px;   /* sheets, modais */
--radius-full: 9999px; /* pills, avatares */

/* Grid mobile-first */
--container-max: 480px;   /* app do cliente/barbeiro */
--sidebar-w: 240px;       /* dashboard gestor */
```

---

## 4. Componentes-base

| Component | Spec essencial |
|---|---|
| **Button primary** | bg `--accent`, texto `--accent-contrast`, `h-48px` mobile / `h-40px` web, radius `--radius-md`, peso 700. Loading: spinner embutido mantendo o label. |
| **Button ghost** | transparente, borda `--border-default`, texto `--text-secondary`. |
| **Button destructive** | bg `--critical-soft`, texto `--critical`, borda `--critical/20`. |
| **Input** | bg `--bg-inset`, borda `--border-default`, focus: borda `--accent` + halo `0 0 0 3px var(--accent-soft)`. Label acima (`--text-sm`, `--text-secondary`). |
| **Card** | bg `--bg-surface`, borda 1px `--border-default`, radius `--radius-lg`, padding `--space-5`. Sem sombra por padrão (sombra só em `--shadow-card` quando flutuante). |
| **KpiCard** | label caps + value mono `--text-2xl` + delta vs período anterior (▲ verde / ▼ vermelho com %). |
| **Chip/SelectCard** | seleção = borda `--accent` + bg `--accent-soft` + check. Nunca só mudança de cor de fundo. |
| **Badge status** | pill com dot + label: `confirmed` ouro · `checked_in` info · `completed` positivo · `no_show` crítico · `cancelled` muted. |
| **Sheet/Modal** | bg `--bg-raised`, radius `--radius-xl` top, handle 36×4px, scrim `--scrim` + blur 8px. |
| **Toast** | bottom-center, `--bg-raised`, ícone + ação "Desfazer" (5s). Substitui **todo** `alert()`/`confirm()`. |
| **BottomNav** | máx. 5 itens, bg `rgba(base,0.9)` + blur 16px, ícone 20px + label 10px caps, ativo = ícone ouro + pill `--accent-soft`. |
| **TimeSlot** | pill mono, `h-40px`, livre: borda subtle · selecionado: ouro sólido · ocupado: riscado, 30% opacidade. |
| **EmptyState** | ilustração 120px + título + 1 CTA. |

---

## 5. Microinterações (Motion)

```css
--ease-out:  cubic-bezier(0.16, 1, 0.3, 1);    /* entradas */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* seleções */
--dur-fast: 150ms;  --dur-base: 250ms;  --dur-slow: 400ms;
```

| Momento | Motion |
|---|---|
| Selecionar horário | Pill ouro desliza entre slots com spring (`layoutId`) — 250ms |
| Confirmar agendamento | Sheet sobe com spring → checkmark SVG `stroke-dashoffset` anima 300ms → confetti discreto de 6 partículas douradas (1x, nunca repetir) |
| KPI ao entrar na aba | Count-up 600ms com `--ease-out`; gráficos desenham da esquerda |
| Botão pressionado | `scale(0.97)` no `:active`, 80ms |
| Marcar concluído | Card desliza para fora (x: -100%) + confirma haptic `vibrate(12)`; undo via toast |
| Troca de tema | Crossfade 300ms em `color`/`background` (sem flash branco: tema aplicado inline no `<head>`) |
| Pull-to-refresh | Barra com ícone de navalha girando |
| Skeleton | Shimmer 1.2s, formato idêntico ao conteúdo |

`@media (prefers-reduced-motion: reduce)` → desliga count-up, spring e confetti; mantém fades de 100ms.

---

## 6. Ícones, Fotos e Detalhes

- **Ícones:** Phosphor (duotone) — peso visual mais rico que Feather/FontAwesome, tom premium. Nunca emojis em UI de produto (ok em mensagens de WhatsApp).
- **Avatares:** foto real do profissional (circle 40px web / 48px mobile) + anel dourado para "disponível agora".
- **Fotos de serviço:** template com fundo grafite e luz lateral — consistência fotográfica = percepção de acabamento.
- **Empty states e login:** ilustrações monocromáticas douradas sobre grafite.

## 7. Tokens Tailwind (tailwind.config.ts)

```ts
// Extensoes essenciais — mapear 1:1 com os CSS vars acima
export const theme = {
  colors: {
    base: 'var(--bg-base)', surface: 'var(--bg-surface)',
    raised: 'var(--bg-raised)', inset: 'var(--bg-inset)',
    accent: { DEFAULT: 'var(--accent)', hover: 'var(--accent-hover)',
              soft: 'var(--accent-soft)', contrast: 'var(--accent-contrast)' },
    positive: 'var(--positive)', critical: 'var(--critical)',
    warning: 'var(--warning)', info: 'var(--info)',
  },
  borderRadius: { sm: '8px', md: '12px', lg: '16px', xl: '24px' },
  fontFamily: { sans: ['Geist', 'Inter'], mono: ['Geist Mono', 'monospace'] },
}
```
