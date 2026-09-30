/**
 * The CEFR bands language goals are measured in, lowest first. Levels between
 * two bands are shown with a plus ("A2+"), so a level is stored as a number of
 * half steps from A1: 0 is A1, 0.5 is A1+, 1 is A2, up to 5 for C2.
 */
export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export type CefrLevel = (typeof CEFR_LEVELS)[number];

const HALF_STEP = 0.5;
/** C2, the top of the half-step scale. */
export const MAX_CEFR_SCORE = CEFR_LEVELS.length - 1;
const LEVEL_LABEL = /^(?<band>A1|A2|B1|B2|C1|C2)(?<plus>\+)?$/u;

export function isCefrLevel(value: unknown): value is CefrLevel {
  return typeof value === "string" && CEFR_LEVELS.some((level) => level === value);
}

/** Keeps a score on the scale and on a half step. */
export function clampCefrScore(score: number): number {
  const rounded = Math.round(score / HALF_STEP) * HALF_STEP;
  return Math.min(MAX_CEFR_SCORE, Math.max(0, rounded));
}

/** "A2" is 1 and "A2+" is 1.5; anything else is null. */
export function parseCefrScore(label: unknown): number | null {
  if (typeof label !== "string") {
    return null;
  }

  const groups = LEVEL_LABEL.exec(label.trim().toUpperCase())?.groups;
  const band = groups?.band;

  if (!band || !isCefrLevel(band)) {
    return null;
  }

  return clampCefrScore(CEFR_LEVELS.indexOf(band) + (groups.plus ? HALF_STEP : 0));
}

/** The band a score sits in: "A2" for both 1 and 1.5. */
export function toCefrLevel(score: number): CefrLevel {
  return CEFR_LEVELS[Math.floor(clampCefrScore(score))] ?? "A1";
}

/** The label learners see: "A2" or "A2+". C2 has nothing above it. */
export function formatCefrScore(score: number): string {
  const clamped = clampCefrScore(score);
  const level = toCefrLevel(clamped);
  return clamped % 1 === 0 || clamped === MAX_CEFR_SCORE ? level : `${level}+`;
}
