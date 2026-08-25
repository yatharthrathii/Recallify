# 04 — Design System

## The brief

This is an app about **memory decay**. The design should feel like a well-made
research instrument, not a SaaS landing page. Reference points: a good lab
notebook, the Financial Times' data graphics, Linear's density — not Notion
clones and not a template.

Two rules govern everything below:

1. **Color is data.** The accent scale encodes memory strength. It is not
   decoration, so it never appears where it means nothing.
2. **One signature, done extremely well.** The forgetting curve. Everything else
   stays quiet so that one thing lands.

---

## Anti-pattern list — the "AI-generated" tells

These are banned. This list exists because the current v1 landing page reads
*"Supercharge Your Memory with Recallify"* over a dark glass card, which is the
exact template look we are trying to escape.

| Banned | Why |
|---|---|
| Purple/indigo/violet gradient (`#6366f1` → `#a855f7`) | The single strongest generated-template tell in existence |
| Gradient text on headings | Same |
| Glassmorphism / `backdrop-blur` as a default surface | 2021 template default |
| Emoji in headings, nav, or buttons | Also a README rule |
| "Supercharge", "Elevate", "Unleash", "Seamlessly", "Effortlessly" | Copy nobody writes by hand |
| 3-column feature grid, lucide icon in a circle above each | Instantly recognisable filler |
| Every block wrapped in a rounded card with `shadow-2xl` | Floaty, weightless, generic |
| Inter as the only typeface | The default of defaults |
| Centered hero with a big blurred colour blob behind it | Template |
| More than one accent hue on a screen | Reads as decoration, not meaning |

### What we do instead

| Do | Effect |
|---|---|
| One accent, used rarely | When it appears, it means something |
| Borders over shadows | Editorial and precise instead of floating |
| Real data density — tables, numbers, small type | Looks like a tool, not a brochure |
| Copy that states facts: "47 cards due · 12 min" | Written by a person |
| Tabular mono for every number | Columns align; looks engineered |
| Asymmetry where the content asks for it | Hand-composed, not grid-generated |

---

## Color

Warm neutrals, not blue-grey. Paper in light, ink in dark.

```ts
// packages/tokens/color.ts
export const light = {
  bg:        '#FAF8F5',   // warm paper, never pure white
  surface:   '#FFFFFF',
  surfaceAlt:'#F2EEE8',
  border:    '#E4DED4',
  borderStrong:'#CFC6B8',
  text:      '#1A1714',
  textMuted: '#6B635A',
  textFaint: '#9A9187',
};

export const dark = {
  bg:        '#12100E',   // warm ink, never #000 and never blue-black
  surface:   '#1A1815',
  surfaceAlt:'#232019',
  border:    '#2E2A24',
  borderStrong:'#453F36',
  text:      '#F2EEE8',
  textMuted: '#A69C8F',
  textFaint: '#6E655A',
};
```

### The memory scale — this is the product's color

Retrievability (probability you can recall the card right now) maps to hue.
This scale is used on the curve, the heatmap, deck badges, and the card border
during review. **Nothing else in the app may use these hues.**

```ts
export const memory = {
  strong:   '#0E7C66',  // R >= 90%  deep teal   — solid
  good:     '#4A9E5C',  // R 75-90%  green
  fading:   '#C88A2E',  // R 50-75%  amber       — the app's de-facto accent
  weak:     '#B85C38',  // R 25-50%  terracotta
  lost:     '#8C3A2E',  // R < 25%   rust        — never fire-engine red
};
```

Amber (`fading`) doubles as the interactive accent — buttons, focus rings, links
— because "about to be forgotten" is the state the whole product exists to act on.

Status colors (`success`/`error`/`info`) are separate, desaturated, and used only
for system feedback. They never appear near the memory scale.

### Theme mechanics

Define the full light palette on bare `:root`. Redefine only what changes inside
`@media (prefers-color-scheme: dark)` guarded as `:root:not([data-theme="light"])`,
and again under `:root[data-theme="dark"]` so the manual toggle wins both ways.
Never let a color's only definition live inside a media query.

---

## Type

```ts
export const font = {
  display: '"Fraunces", "Iowan Old Style", Georgia, serif',
  ui:      '"IBM Plex Sans", system-ui, -apple-system, sans-serif',
  mono:    '"IBM Plex Mono", ui-monospace, "SF Mono", monospace',
};
```

**Fraunces** — variable serif with optical-size and `WONK` axes. It has a real
voice and no template ever ships with it. Set `WONK` to 0-ish and `opsz` high for
large headings so it reads editorial rather than novelty. If it ever feels too
characterful for a screen, **Instrument Serif** is the restrained substitute —
but do not fall back to Inter for display.

**IBM Plex Sans** for all interface text. More character than Inter, and it pairs
natively with Plex Mono, which keeps the system coherent for free.

**IBM Plex Mono** for every number: stats, intervals, retention percentages, axis
labels, dates. Always `font-variant-numeric: tabular-nums` so columns align.

All three load from Google Fonts with `display: swap` and a real fallback stack.

### Scale — 1.25 ratio, and these are the only sizes

| Token | Size / line-height | Face | Use |
|---|---|---|---|
| `display` | 48/52 | Fraunces | landing h1 only |
| `h1` | 34/40 | Fraunces | page title |
| `h2` | 26/32 | Fraunces | section |
| `h3` | 20/28 | Plex Sans 600 | subsection |
| `body` | 16/26 | Plex Sans | prose |
| `ui` | 14/20 | Plex Sans | controls, labels |
| `caption` | 12/16 | Plex Sans | metadata |
| `data` | 14/20 | Plex Mono | all numbers |
| `dataLg` | 28/32 | Plex Mono | stat tiles |

The review card front/back is the exception — it scales `clamp(20px, 4vw, 34px)`
because it is the only thing on screen and must be readable at arm's length.

---

## Space, shape, elevation

Deliberately small sets. Consistency comes from having few choices, not from
discipline.

```ts
export const space  = [0, 4, 8, 12, 16, 24, 32, 48, 64, 96];  // 4px base
export const radius = { sm: 4, md: 8, lg: 12, full: 9999 };   // three, plus pill
export const border = { hair: 1, strong: 2 };                 // two weights
export const shadow = {
  none: 'none',
  sm: '0 1px 2px rgb(0 0 0 / 0.04)',
  md: '0 4px 12px rgb(0 0 0 / 0.06)',   // modals and popovers ONLY
};
```

Three surface levels: `bg` → `surface` → `surfaceAlt`. Never nest deeper. If a
design needs a fourth level, the layout is wrong.

Default to `border` for separation. `shadow.md` is reserved for things that
genuinely float above the page — dialogs, the command palette, popovers.

---

## Motion

Motion directs attention. It is never ambient and it never loops.

```ts
export const motion = {
  instant: 90,    // hover, focus, press
  fast:    160,   // reveal, dropdown, tooltip
  base:    240,   // page / view transition
  slow:    420,   // curve draw-on, once per mount
  spring:  { type: 'spring', stiffness: 320, damping: 30 },  // card flip only
  ease:    [0.22, 1, 0.36, 1],   // easeOutQuint — decisive, no bounce
};
```

| Interaction | Treatment |
|---|---|
| Card flip | Spring, 3D `rotateY`, `transform` only |
| Next card | View Transition, 240ms slide + fade |
| Rating press | 90ms scale to 0.97, then release |
| Forgetting curve | Path draws left-to-right over 420ms **once**, then static |
| Heatmap | Cells fade in on a 6ms stagger; capped at 300ms total |
| Skeleton | Opacity pulse 1.6s. No sweeping shimmer gradient |
| Page enter | 8px rise + fade, 240ms |

Animate `transform` and `opacity` only. Any animation touching layout is a bug.

`prefers-reduced-motion: reduce` → all durations to 0 except opacity fades, which
drop to 90ms. The curve renders complete rather than drawing.

---

## Consistency mechanism

Consistency is enforced by tooling, not by remembering.

1. **`packages/tokens` is the only source of design values.** Web reads it as CSS
   variables via Tailwind `@theme`; React Native reads the same object as a JS
   StyleSheet. One file, both platforms, no drift.
2. **No raw hex in any component.** ESLint rule fails the build on
   `/#[0-9a-fA-F]{3,8}/` outside `packages/tokens`.
3. **Every page uses `<PageShell>`** — identical max-width, header rhythm,
   vertical spacing. Pages differ in content, never in chrome.
4. **One primitive per job.** One `Button` with variants; not five button-shaped
   things. Same for `Card`, `Field`, `Dialog`, `StatTile`.
5. **Radix for anything with keyboard or ARIA semantics** — dialog, popover,
   dropdown, tooltip, toggle. Styled by us. We never hand-roll focus traps.

> On shadcn: use it as a *reference implementation* to read, not a theme to
> install. Its default look is one of the tells above. Take the Radix patterns,
> write our own styles against our tokens.

---

## Signature component: the forgetting curve

This is the thing people screenshot. It gets more care than everything else.

- Hand-built SVG with `d3-shape` for the path math. No chart library — Recharts
  output looks like every other dashboard and this must not.
- X = time, Y = retrievability 0-100%.
- The curve is stroked with a gradient along the memory scale, so its color at
  any point *is* the retention at that point.
- Each review is a marker where the curve steps back up — the visual proof that
  reviewing raises stability.
- A dashed horizontal line at the user's desired retention. Where the curve
  crosses it is the due date, labelled.
- Hover/focus gives a crosshair with exact date and R% in mono.
- Fully keyboard navigable: arrow keys step between review markers.
- Renders correctly in both themes with no re-tinting.

---

## Accessibility — non-negotiable

- WCAG AA contrast: 4.5:1 body, 3:1 large text and UI borders. Verify the memory
  scale against **both** backgrounds; `fading` amber is the one that will fail
  first on light — darken it there rather than tinting the background.
- Visible focus ring everywhere: 2px accent, 2px offset. Never `outline: none`
  without a replacement.
- Color is never the only signal. The heatmap carries a count in its tooltip;
  card states carry a text label alongside the hue.
- Review is fully operable by keyboard — that is a listed feature, so it is also
  an accessibility guarantee.
- Every icon-only button has an `aria-label`. Every input has a real `<label>`.
- Respect `prefers-reduced-motion`.

---

## Copy rules

Say the fact. The product is about precision, so the writing should be precise.

| Instead of | Write |
|---|---|
| "Supercharge your memory!" | "47 cards due today. About 12 minutes." |
| "Great job! You're crushing it!" | "Session complete. 18 reviewed, 3 lapses." |
| "Oops! Something went wrong" | "Couldn't save your review. Retrying — nothing is lost." |
| "AI-Powered Smart Learning" | "Generate cards from a topic or pasted notes." |

No exclamation marks in system copy. No emoji in the UI. Error messages say what
happened, whether data was lost, and what happens next.
