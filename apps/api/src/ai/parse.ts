import {
  type GeneratedCard,
  generateResponse,
  generatedCard,
} from '@recallify/contracts';

export interface ParsedDrafts {
  /** False when the reply was not a JSON object with a `cards` array at all. */
  readonly parsed: boolean;
  readonly drafts: GeneratedCard[];
  /** Cards that failed validation or repeated an earlier one. */
  readonly discarded: number;
}

/**
 * JSON mode should make fences impossible, but a model that wraps its answer in
 * ```json anyway should not cost the user a generation.
 */
function unfence(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced ? (fenced[1] ?? '') : trimmed;
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Prose around an object: take the outermost braces and try once more.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return undefined;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
}

/**
 * Turn a model reply into drafts, one card at a time.
 *
 * Validating each card separately means one overlong answer costs one card
 * rather than the whole generation. Anything beyond `count` is dropped without
 * being counted as discarded -- those cards were fine, just not asked for.
 */
export function parseDrafts(text: string, count: number): ParsedDrafts {
  const envelope = generateResponse.safeParse(tryParse(unfence(text)));
  if (!envelope.success) return { parsed: false, drafts: [], discarded: 0 };

  const drafts: GeneratedCard[] = [];
  const seen = new Set<string>();
  let discarded = 0;

  for (const raw of envelope.data.cards) {
    // Models write "hint": null or "" for "no hint". Both mean absent.
    const candidate =
      raw && typeof raw === 'object'
        ? Object.fromEntries(
            Object.entries(raw as Record<string, unknown>).filter(
              ([key, value]) => !(key === 'hint' && (value === null || value === '')),
            ),
          )
        : raw;

    const card = generatedCard.safeParse(candidate);
    if (!card.success) {
      discarded += 1;
      continue;
    }

    const key = card.data.front.toLowerCase();
    if (seen.has(key)) {
      discarded += 1;
      continue;
    }
    seen.add(key);

    if (drafts.length < count) drafts.push(card.data);
  }

  return { parsed: true, drafts, discarded };
}
