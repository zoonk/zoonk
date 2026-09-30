import { type CourseLevel, type LanguageSkill, type StepKind } from "@zoonk/db";
import { clampCefrScore, parseCefrScore } from "@zoonk/utils/cefr";
import { isJsonObject } from "@zoonk/utils/json";

export const LANGUAGE_SKILLS = [
  "reading",
  "listening",
  "speaking",
  "writing",
] as const satisfies readonly LanguageSkill[];

/** Answers a window holds before it moves a level: enough that one lucky day never does. */
const LEVEL_WINDOW_ANSWERS = 20;

/** Share of right answers in a window that lifts the level half a step. */
const RISE_ACCURACY = 0.85;

/** Below this share the level comes down half a step, so the plan eases off. */
const DROP_ACCURACY = 0.5;

const HALF_STEP = 0.5;

/** Where a learner starts when nothing says their level: A1. */
const DEFAULT_START_SCORE = 0;

/**
 * The CEFR band each Library level teaches a language in, the same on unit pages and in the lesson
 * writer's input. Language courses have no overview band; one would teach what beginner does.
 */
export const CEFR_BANDS: Readonly<Record<CourseLevel, string>> = {
  advanced: "C1–C2",
  beginner: "A1–A2",
  intermediate: "B1–B2",
  overview: "A1–A2",
};

/**
 * The highest level each Library band teaches, on the half-step scale: getting beginner content
 * right shows at most A2+, so a window of easy answers can't lift a level past what it tested.
 */
const CONTENT_CEILINGS: Readonly<Record<CourseLevel, number>> = {
  advanced: 5,
  beginner: 1.5,
  intermediate: 3.5,
  overview: 1.5,
};

/**
 * Which skill a language lesson screen shows evidence for. Words, reading and grammar practice
 * are read; summaries and explanations aren't answered.
 */
const STEP_SKILLS: Partial<Record<StepKind, LanguageSkill>> = {
  fillBlank: "reading",
  listening: "listening",
  matchColumns: "reading",
  multipleChoice: "reading",
  reading: "reading",
  spokenAnswer: "speaking",
  translation: "reading",
  typedAnswer: "writing",
  vocabulary: "reading",
};

export type SkillLevelState = {
  score: number;
  startScore: number;
  windowCeiling: number | null;
  windowCorrect: number;
  windowTotal: number;
};

export type LevelEvidence = {
  /** The level of the content answered, on the half-step scale. */
  ceiling: number;
  correct: number;
  total: number;
};

export function getStepLanguageSkill(kind: StepKind): LanguageSkill | null {
  return STEP_SKILLS[kind] ?? null;
}

export function getContentCeiling(level: CourseLevel): number {
  return CONTENT_CEILINGS[level];
}

/**
 * Where a skill starts: its own level from the level test, then the level the learner gave for
 * the whole language, then A1.
 */
export function getStartScore({
  details,
  skill,
}: {
  details: Record<string, unknown>;
  skill: LanguageSkill;
}): number {
  const own = isJsonObject(details.skillLevels) ? parseCefrScore(details.skillLevels[skill]) : null;

  return own ?? parseCefrScore(details.level) ?? DEFAULT_START_SCORE;
}

function getNextScore({ score, windowCeiling, windowCorrect, windowTotal }: SkillLevelState) {
  const accuracy = windowCorrect / windowTotal;
  const ceiling = windowCeiling ?? score;

  if (accuracy >= RISE_ACCURACY && ceiling >= score) {
    return clampCefrScore(Math.min(score + HALF_STEP, ceiling + HALF_STEP));
  }

  if (accuracy < DROP_ACCURACY) {
    return clampCefrScore(score - HALF_STEP);
  }

  return score;
}

/**
 * Adds answers to the skill's current window. A full window moves the level at most half a step:
 * up when nearly everything was right on content at or above the level, down when most was wrong,
 * and then a new window starts.
 */
export function applyLevelEvidence(
  state: SkillLevelState,
  evidence: LevelEvidence,
): SkillLevelState {
  const next = {
    ...state,
    windowCeiling:
      evidence.correct > 0
        ? Math.max(state.windowCeiling ?? evidence.ceiling, evidence.ceiling)
        : state.windowCeiling,
    windowCorrect: state.windowCorrect + evidence.correct,
    windowTotal: state.windowTotal + evidence.total,
  };

  if (next.windowTotal < LEVEL_WINDOW_ANSWERS) {
    return next;
  }

  return {
    score: getNextScore(next),
    startScore: state.startScore,
    windowCeiling: null,
    windowCorrect: 0,
    windowTotal: 0,
  };
}

export type LevelTrend = "down" | "same" | "up";

/** How a skill moved since the level test. */
export function getLevelTrend({
  score,
  startScore,
}: Pick<SkillLevelState, "score" | "startScore">): LevelTrend {
  if (score > startScore) {
    return "up";
  }

  return score < startScore ? "down" : "same";
}
