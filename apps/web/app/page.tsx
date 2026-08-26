import { memory } from '@recallify/tokens';

/**
 * Phase 1 placeholder. Deliberately states what does and does not exist yet —
 * the whole project exists because v1 shipped a description that ran ahead of
 * the code. Phase 6 replaces this with the real landing page.
 */

const phases = [
  { n: 0, name: 'Corrections to v1', done: true },
  { n: 1, name: 'Monorepo, schema, CI', done: true },
  { n: 2, name: 'FSRS engine: model + scheduler', done: true },
  { n: 3, name: 'Parameter optimizer', done: false },
  { n: 4, name: 'API', done: false },
  { n: 5, name: 'AI generation', done: false },
  { n: 6, name: 'Web client', done: false },
  { n: 7, name: 'Deploy, seed, demo', done: false },
];

const scale = [
  { label: 'strong', range: 'R >= 90%', hex: memory.strong },
  { label: 'good', range: '75-90%', hex: memory.good },
  { label: 'fading', range: '50-75%', hex: memory.fading },
  { label: 'weak', range: '25-50%', hex: memory.weak },
  { label: 'lost', range: '< 25%', hex: memory.lost },
];

export default function Page() {
  return (
    <main className="mx-auto max-w-[680px] px-6 py-24">
      <p
        className="tabular text-xs uppercase"
        style={{ color: 'var(--text-faint)', letterSpacing: '0.08em' }}
      >
        v2 &middot; phase 2 of 7
      </p>

      <h1 className="mt-3 text-[34px] leading-10">Recallify</h1>

      <p className="mt-4 text-balance" style={{ color: 'var(--text-muted)' }}>
        A spaced-repetition scheduler built on FSRS. Every other app in this
        category hides its scheduler; this one shows you the curve, why a card is
        due, and what your own review history says about the defaults.
      </p>

      <p className="mt-4 text-sm" style={{ color: 'var(--text-faint)' }}>
        There is no API, no database and no interface yet. What does exist is the
        scheduler: the forgetting curve, the difficulty and stability updates, the
        learning ladder, and replay from an append-only log &mdash; held in place by
        97 tests, including a differential test against the reference
        implementation. This page will keep saying exactly what is and is not built.
      </p>

      <section className="mt-12">
        <h2 className="text-[20px] leading-7" style={{ fontFamily: 'var(--font-ui)' }}>
          Build order
        </h2>
        <ol className="mt-4">
          {phases.map((p) => (
            <li
              key={p.n}
              className="flex items-baseline gap-4 border-t py-2.5 text-sm"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="tabular w-6" style={{ color: 'var(--text-faint)' }}>
                {p.n}
              </span>
              <span style={{ color: p.done ? 'var(--text)' : 'var(--text-muted)' }}>
                {p.name}
              </span>
              <span
                className="tabular ml-auto text-xs"
                style={{ color: p.done ? 'var(--memory-strong)' : 'var(--text-faint)' }}
              >
                {p.done ? 'done' : 'pending'}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="text-[20px] leading-7" style={{ fontFamily: 'var(--font-ui)' }}>
          Memory scale
        </h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Colour is data here. Hue encodes retrievability &mdash; the probability
          you could recall a card right now &mdash; and nothing outside the curve,
          heatmap and card border is allowed to use these five.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {scale.map((s) => (
            <li
              key={s.label}
              className="flex items-center gap-2 rounded border px-2.5 py-1.5"
              style={{ borderColor: 'var(--border)' }}
            >
              <span
                aria-hidden
                className="size-3 rounded-sm"
                style={{ background: s.hex }}
              />
              <span className="text-sm">{s.label}</span>
              <span className="tabular text-xs" style={{ color: 'var(--text-faint)' }}>
                {s.range}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <footer
        className="mt-16 border-t pt-6 text-sm"
        style={{ borderColor: 'var(--border)', color: 'var(--text-faint)' }}
      >
        Design rules in <span className="tabular">docs/04-DESIGN-SYSTEM.md</span>.
        Build order in <span className="tabular">docs/06-ROADMAP.md</span>.
      </footer>
    </main>
  );
}
