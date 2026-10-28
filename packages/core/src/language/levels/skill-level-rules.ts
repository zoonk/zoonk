import { type CourseLevel, type LanguageSkill, type StepKind } from "@zoonk/db";
import { clampCefrScore, formatCefrScore, parseCefrScore } from "@zoonk/utils/cefr";
import { isJsonObject } from "@zoonk/utils/json";

export const LANGUAGE_SKILLS = [
  "reading",
  "listening",
  "speaking",
  "writing",
] as const satisfies readonly LanguageSkill[];

const LEVEL_WINDOW_ANSWERS = 20;

const RISE_ACCURACY = 0.85;

const DROP_ACCURACY = 0.5;

const HALF_STEP = 0.5;

const DEFAULT_START_SCORE = 0;

export const CEFR_BANDS: Readonly<Record<CourseLevel, string>> = {
  advanced: "C1–C2",
  beginner: "A1–A2",
  intermediate: "B1–B2",
  overview: "A1–A2",
};

const CONTENT_CEILINGS: Readonly<Record<CourseLevel, number>> = {
  advanced: 5,
  beginner: 1.5,
  intermediate: 3.5,
  overview: 1.5,
};

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

export type LevelEvidence = { ceiling: number; correct: number; total: number };

export function getStepLanguageSkill(kind: StepKind): LanguageSkill | null {
  return STEP_SKILLS[kind] ?? null;
}

export function getContentCeiling(level: CourseLevel): number {
  return CONTENT_CEILINGS[level];
}

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

export function getLevelTrend({
  score,
  startScore,
}: Pick<SkillLevelState, "score" | "startScore">): LevelTrend {
  if (score > startScore) {
    return "up";
  }

  return score < startScore ? "down" : "same";
}

export function getOverallLevel(scores: readonly number[]): string | null {
  if (scores.length === 0) {
    return null;
  }

  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return formatCefrScore(Math.floor(average / HALF_STEP) * HALF_STEP);
}
