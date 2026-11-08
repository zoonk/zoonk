import {
  type CefrLevel,
  MAX_CEFR_SCORE,
  formatCefrScore,
  parseCefrScore,
  toCefrLevel,
} from "@zoonk/utils/cefr";
import { type JsonObject } from "@zoonk/utils/json";

/** Why a learner studies a language, in the order the reason question lists them. */
export const LANGUAGE_REASONS = [
  "travel",
  "talk",
  "work",
  "fluent",
  "certificate",
  "other",
] as const;

export type LanguageReason = (typeof LANGUAGE_REASONS)[number];

/** The levels a learner can aim for, each the level a reason needs. */
export const LANGUAGE_AIMS = ["A2", "B1", "B2", "C1"] as const satisfies readonly CefrLevel[];

export type LanguageAim = (typeof LANGUAGE_AIMS)[number];

/** A certificate names no level: its exam decides what the plan aims for. */
const REASON_AIMS: Readonly<Record<LanguageReason, LanguageAim | null>> = {
  certificate: null,
  fluent: "C1",
  other: "B1",
  talk: "B1",
  travel: "A2",
  work: "B2",
};

/**
 * Cambridge English's guided learning hours (support.cambridgeenglish.org), the middle of each
 * range; A1, which it doesn't list, at half of A2. They count practice too.
 */
const GUIDED_HOURS: Readonly<Record<CefrLevel, number>> = {
  A1: 95,
  A2: 190,
  B1: 375,
  B2: 550,
  C1: 750,
  C2: 1100,
};

const OWN_LEVEL_HOURS: Readonly<Record<string, number>> = {
  advanced: GUIDED_HOURS.C1,
  basic: GUIDED_HOURS.A2,
  intermediate: GUIDED_HOURS.B1,
  none: 0,
};

export function isLanguageReason(value: unknown): value is LanguageReason {
  return LANGUAGE_REASONS.some((reason) => reason === value);
}

export function getReasonAim(reason: LanguageReason): LanguageAim | null {
  return REASON_AIMS[reason];
}

export function isLanguageAim(value: unknown): value is LanguageAim {
  return LANGUAGE_AIMS.some((aim) => aim === value);
}

export function getCefrHours(score: number): number {
  const level = Math.floor(score);
  const below = GUIDED_HOURS[toCefrLevel(level)];
  const above = level + 1 <= MAX_CEFR_SCORE ? GUIDED_HOURS[toCefrLevel(level + 1)] : below;

  return below + (above - below) * (score - level);
}

/** Hours already behind a learner at `level`: a CEFR label, or the level they said (`basic`). */
export function getStartHours(level: unknown): number | null {
  const score = parseCefrScore(level);

  if (score !== null) {
    return getCefrHours(score);
  }

  return typeof level === "string" ? (OWN_LEVEL_HOURS[level] ?? null) : null;
}

/**
 * What a language goal aims for, as its CEFR label: the level the learner picked, or the one their
 * words named, half bands included ("B1+").
 */
export function readLanguageAim(details: Record<string, unknown>): string | null {
  const score = parseCefrScore(details.targetScore) ?? parseCefrScore(details.targetLevel);
  return score === null ? null : formatCefrScore(score);
}

export type LanguageAimChoice = {
  aim: LanguageAim;
  /** Hours of study left to reach it from the learner's level; from scratch when it isn't known. */
  hours: number;
};

export type LanguageAimView = {
  aim: CefrLevel | null;
  /** The aims above the learner's level, lowest first. */
  choices: LanguageAimChoice[];
};

/** Language goals only: the reason question's choices, and the aim the time question shows. */
export type OnboardingLanguageAim = LanguageAimView & { reasons: readonly LanguageReasonView[] };

export type LanguageReasonView = {
  aim: LanguageAim | null;
  /** Hours of study from scratch; null for a certificate. */
  hours: number | null;
  reason: LanguageReason;
};

export function toLanguageAimView(details: Record<string, unknown>): LanguageAimView {
  const start = getStartHours(details.level) ?? 0;
  const score = parseCefrScore(readLanguageAim(details));

  return {
    aim: score === null ? null : toCefrLevel(score),
    choices: LANGUAGE_AIMS.flatMap((aim) => {
      const hours = Math.round(GUIDED_HOURS[aim] - start);
      return hours > 0 ? [{ aim, hours }] : [];
    }),
  };
}

export const LANGUAGE_REASON_VIEWS: readonly LanguageReasonView[] = LANGUAGE_REASONS.map(
  (reason) => {
    const aim = getReasonAim(reason);
    return { aim, hours: aim ? GUIDED_HOURS[aim] : null, reason };
  },
);

/** The goal's details aiming for `aim`; null when they already do. */
export function withLanguageAim({
  aim,
  details,
}: {
  aim: string | null;
  details: JsonObject;
}): JsonObject | null {
  if (readLanguageAim(details) === aim) {
    return null;
  }

  const { targetLevel: _level, targetScore: _score, ...rest } = details;
  return aim === null ? rest : { ...rest, targetScore: aim };
}
