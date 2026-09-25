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
| Centered hero with a big blurred colour blob behind it | Template. The landing disc is flat colour with a hard edge, off to one side |
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

Two palettes, one per theme. Yatharth picked both from sites he liked, not from
a generator, after the first theme (warm paper, serif, amber) read as generic.
Light is blush paper with navy ink and a raspberry accent. Dark is slate with a
deep teal block colour and the same raspberry, lifted.

```ts
// packages/tokens/color.ts
export const light = {
  bg:        '#EEE2DC',   // blush paper. The page is tinted, panels are lighter
  surface:   '#F8F1EC',
  surfaceAlt:'#E6D6CE',
  border:    '#DDCBC1',
  borderStrong:'#BAB2B5',
  text:      '#123C69',   // navy ink, never black
  textMuted: '#55637F',
  textFaint: '#66606E',
};

export const dark = {
  bg:        '#212A31',   // slate, never #000
  surface:   '#28333C',
  surfaceAlt:'#2E3944',
  border:    '#37444F',
  borderStrong:'#4C5C68',
  text:      '#D3D9D4',
  textMuted: '#9DB0B4',
  textFaint: '#8CA0A6',
};

export const brand       = { accent: '#AC3B61', brand: '#123C69', onBrand: '#EEE2DC', highlight: '#EDC7B7' };
export const brandOnDark = { accent: '#EE8FA9', brand: '#124E66', onBrand: '#D3D9D4', highlight: '#124E66' };
```

- `accent` marks what wants attention: a due count, a link, a focus ring, the
  hover state of the primary button. It is **not** on the memory scale.
- `brand` is the full-bleed block colour: the Today panel, the auth side panel,
  the landing marquee and demo band. One block per screen.
- `highlight` is the flat disc behind the landing headline and the closing band.
- A fixed SVG grain sits over the whole page at 5 to 7% so flat colour reads as
  a material.

Every pairing was measured: body text is 8.8:1 in light and 10.2:1 in dark,
muted text 4.8:1 and 6.5:1, the accent 4.7:1 and 6.3:1. Faint text, the
lightest text allowed anywhere, is 4.8:1 on the page and 5.4:1 on a surface in
light, 5.3:1 and 4.7:1 in dark. It was lighter until Lighthouse measured it at
3.1:1 in phase 7; Lighthouse CI now fails the build if accessibility drops
below 0.95, so a pale label cannot come back unnoticed.

### The memory scale — this is the product's color

Retrievability (probability you can recall the card right now) maps to hue.
This scale is used on the curve, the heatmap, deck badges, and the card border
during review. **Nothing else in the app may use these hues.**

```ts
export const memory = {
  strong:   '#0E7C66',  // R >= 90%  deep teal
  good:     '#3A8049',  // R 75-90%  green
  fading:   '#96620F',  // R 50-75%  amber, darkened to read on blush
  weak:     '#B1532F',  // R 25-50%  terracotta
  lost:     '#8C3A2E',  // R < 25%   rust        — never fire-engine red
};
```

`memoryOnDark` lifts every band for slate. The interactive accent used to be
the amber band; it is now raspberry, so no control ever looks like a data point.

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
  display: '"Bricolage Grotesque", "Helvetica Neue", Arial, sans-serif',
  ui:      '"IBM Plex Sans", system-ui, -apple-system, sans-serif',
  mono:    '"IBM Plex Mono", ui-monospace, "SF Mono", monospace',
};
```

**Bricolage Grotesque** — variable grotesque with an optical-size axis. Slightly
irregular on purpose, which is what stops a large headline looking typeset by a
template. Always tight (`-0.035em`), always large, line-height near 1. It
replaced Fraunces: a warm serif on cream paper had become a recognisable
generated look of its own. Do not fall back to Inter for display.

**IBM Plex Sans** for all interface text. More character than Inter, and it pairs
natively with Plex Mono, which keeps the system coherent for free.

**IBM Plex Mono** for every number: stats, intervals, retention percentages, axis
labels, dates. Always `font-variant-numeric: tabular-nums` so columns align.

All three load from Google Fonts with `display: swap` and a real fallback stack.

### Scale — 1.25 ratio, and these are the only sizes

| Token | Size / line-height | Face | Use |
|---|---|---|---|
| `display` | 64/64, fluid to 124 | Bricolage | landing h1 only |
| `h1` | 34 to 48 | Bricolage | page title |
| `h2` | 26/32 | Bricolage | section |
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

Things arrive; they do not just appear. The first version of these tokens was
so restrained (240ms, 8px) that Yatharth could not see any animation at all, so
they are now sized to be noticed. One library does all of it: `motion`.
Primitives live in `apps/web/components/motion`.

```ts
export const duration = { instant: 120, fast: 220, base: 520, slow: 900, draw: 1400 };
export const rise = 28;                    // px a block travels as it rises in
export const ease = [0.16, 1, 0.3, 1];     // easeOutExpo, every entrance
```

| Interaction | Treatment |
|---|---|
| Headlines (landing, page titles) | Pushed up through a clipped slot, a word at a time |
| Blocks and sections | 28px rise + fade, once, when scrolled into view |
| Lists, stat tiles | Children staggered 60 to 80ms apart |
| Numbers | Count up from zero on first sight, glide on change |
| Forgetting curve | Line draws over 1.4s, markers pop as the line reaches them |
| Heatmap | Cells scale in as a wave across the year |
| Forecast bars | Grow from the baseline, 30ms apart |
| Card flip | Spring, 3D `rotateY` |
| Next card | Old card thrown left, new one dealt in from the right, turned 2.5 degrees |
| Session complete | A ring closes and a tick is drawn |
| Primary button | Lifts 2px and turns from ink to accent |
| Sidebar | Active pill slides between items on a spring |
| Theme change | Colours cross-fade over 420ms |
| Landing | Header drops in, disc parallax, facts marquee (the one loop) |
| Toasts | Sonner, restyled as an ink slab; errors turn the whole slab |
| Skeleton | Opacity pulse 1.6s. No sweeping shimmer gradient |

Animate `transform`, `opacity` and `pathLength` only. Any animation touching
layout is a bug.

`prefers-reduced-motion: reduce` → `MotionConfig reducedMotion="user"` drops all
movement, CSS durations collapse, and the curve renders complete.

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
