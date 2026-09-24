import { ImageResponse } from 'next/og';

export const alt = 'Recallify. A flashcard scheduler that shows its work.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// The brand palette from @recallify/tokens. Spelled out as rgb() because the
// repo's lint rule reserves hex literals for the tokens package, and this file
// runs in the image renderer where the CSS variables do not exist.
const PAPER = 'rgb(238 226 220)';
const INK = 'rgb(18 60 105)';
const ACCENT = 'rgb(172 59 97)';
const HIGHLIGHT = 'rgb(237 199 183)';
const MUTED = 'rgb(85 99 127)';

/** The card shown when a link to the site is pasted into a chat or a feed. */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 72,
        background: PAPER,
        color: INK,
        fontFamily: 'sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: -160,
          top: -220,
          width: 640,
          height: 640,
          borderRadius: 9999,
          background: HIGHLIGHT,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <svg
          width="44"
          height="44"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 5c2.5 6 5 9.5 8.5 11" stroke={INK} />
          <path d="M11.5 16V6.5" stroke={MUTED} strokeDasharray="1.5 3" />
          <path d="M11.5 6.5c3 3.5 6 6 9.5 7.5" stroke={ACCENT} />
        </svg>
        <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1 }}>Recallify</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 88,
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: -4,
          }}
        >
          <div style={{ display: 'flex' }}>A flashcard scheduler</div>
          <div style={{ display: 'flex' }}>
            <span>that shows its</span>
            <span style={{ color: ACCENT, marginLeft: 22 }}>work.</span>
          </div>
        </div>
        <div style={{ fontSize: 30, color: MUTED, maxWidth: 900, lineHeight: 1.3 }}>
          The forgetting curve of every card, why each one is due today, and a schedule
          fitted to your own answers. Free, no ads.
        </div>
      </div>
    </div>,
    size,
  );
}
