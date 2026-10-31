import {
  normalizePunctuation,
  normalizeString,
  segmentLearnerWords,
  segmentWords,
  stripPunctuation,
} from "./string";

export type DistractorShape = "any" | "single-learner-word" | "single-word";

function getNormalizedText(text: string): string | null {
  const normalizedText = normalizePunctuation(text).trim();

  return normalizedText || null;
}

export function normalizeDistractorKey(text: string): string {
  return normalizeString(stripPunctuation(text));
}

function hasSupportedShape(params: { distractor: string; shape: DistractorShape }): boolean {
  if (params.shape === "any") {
    return true;
  }

  const words =
    params.shape === "single-learner-word"
      ? segmentLearnerWords(params.distractor)
      : segmentWords(params.distractor);

  return words.length === 1;
}

export function sanitizeDistractors(params: {
  distractors: string[];
  input: string;
  shape?: DistractorShape;
}): string[] {
  const shape = params.shape ?? "single-word";
  const inputKey = normalizeDistractorKey(normalizePunctuation(params.input).trim());
  const seenDistractors = new Set<string>();

  return params.distractors.flatMap((distractor) => {
    const normalizedDistractor = getNormalizedText(distractor);

    if (!normalizedDistractor) {
      return [];
    }

    const distractorKey = normalizeDistractorKey(normalizedDistractor);

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
