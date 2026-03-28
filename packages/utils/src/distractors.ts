import { normalizePunctuation, normalizeString, segmentWords, stripPunctuation } from "./string";

export type DistractorShape = "any" | "single-word";

/**
 * AI output often contains extra whitespace or punctuation-only noise. Normalizing once
 * here gives the rest of the sanitizer a stable input to reason about.
 */
function getNormalizedText(text: string): string | null {
  const normalizedText = normalizePunctuation(text).trim();

  return normalizedText || null;
}

/**
 * Distractor collisions should ignore casing and punctuation so variants like
 * "Boa tarde" and "boa tarde!" collapse to one stable option.
 */
function getDistractorKey(text: string): string {
  return normalizeString(stripPunctuation(text));
}

/**
 * Reading and listening word banks require single-word distractors, but translation
 * distractors can be either words or phrases. This helper only enforces the hard
 * runtime constraint so we do not bake brittle linguistic assumptions into the player.
 */
function hasSupportedShape(params: { distractor: string; shape: DistractorShape }): boolean {
  if (params.shape === "any") {
    return true;
  }

  return segmentWords(params.distractor).length === 1;
}

/**
 * Distractors power wrong-answer UI, so they must stay short, stable, and safe. This
 * helper keeps one shared rule for trimming AI output down to usable distractors before
 * we save or render them.
 */
export function sanitizeDistractors(params: {
  distractors: string[];
  input: string;
  shape?: DistractorShape;
}): string[] {
  const shape = params.shape ?? "single-word";
  const inputKey = getDistractorKey(normalizePunctuation(params.input).trim());
  const seenDistractors = new Set<string>();

  return params.distractors.flatMap((distractor) => {
    const normalizedDistractor = getNormalizedText(distractor);

    if (!normalizedDistractor) {
      return [];
    }

    const distractorKey = getDistractorKey(normalizedDistractor);

    if (!distractorKey || distractorKey === inputKey || seenDistractors.has(distractorKey)) {
      return [];
    }

    if (!hasSupportedShape({ distractor: normalizedDistractor, shape })) {
      return [];
    }

    seenDistractors.add(distractorKey);

    return [normalizedDistractor];
  });
}
