import { type MasteryState, type MistakeCause } from "@zoonk/db";

/** What code can read from a wrong answer before any model looks at it. */
export type MistakeSignals = {
  durationMs: number;
  /** The question as the learner saw it, to estimate how long reading it takes. */
  questionText: string;
  /** Set for timed activities (mocks, timed drills). */
  timeLimitMs?: number | null;
  /** The item's misconception tag for the wrong option the learner chose, when it has one. */
  misconception?: string | null;
  /** The learner's recent answers on the same skill, before this one. */
  recentSkillAnswers: { correct: number; total: number };
  skillState: MasteryState;
};

const READING_WORDS_PER_MINUTE = 250;
const MS_PER_MINUTE = 60_000;
const MIN_READING_MS = 1500;

/** Answering in under half the time it takes to read the question is a guess. */
const GUESS_READING_SHARE = 0.5;

/** Accuracy needs a few answers to mean anything. */
const MIN_ANSWERS_FOR_ACCURACY = 3;
const STRONG_ACCURACY = 0.8;
const WEAK_ACCURACY = 0.5;

/** Roughly how long reading a question takes at an everyday reading pace. */
function estimateReadingMs(text: string): number {
  const words = text.trim().split(/\s+/u).filter(Boolean).length;
  return Math.max(MIN_READING_MS, Math.round((words / READING_WORDS_PER_MINUTE) * MS_PER_MINUTE));
}

function getAccuracy({ correct, total }: MistakeSignals["recentSkillAnswers"]): number | null {
  return total >= MIN_ANSWERS_FOR_ACCURACY ? correct / total : null;
}

function getSkillStanding(signals: MistakeSignals): "mixed" | "strong" | "weak" {
  const accuracy = getAccuracy(signals.recentSkillAnswers);

  if (signals.skillState === "solid" || signals.skillState === "mastered") {
    return "strong";
  }

  if (accuracy !== null && accuracy >= STRONG_ACCURACY) {
    return "strong";
  }

  if (signals.skillState === "new" || accuracy === null || accuracy < WEAK_ACCURACY) {
    return "weak";
  }

  return "mixed";
}

/**
 * Names the cause of a wrong answer from its pattern and the item's misconception tag, or returns
 * null when the pattern is ambiguous and a classifier should decide. Time and speed come first
 * because they are facts: over the time limit is `time`, faster than reading the question is
 * `guess`. Then the learner's standing on the skill: someone who usually gets it right fell for
 * the option's `trap` (tagged option) or `misread` (no tag), and someone still learning it has a
 * content `gap`. Mixed standing is left to the classifier.
 */
export function inferMistakeCause(signals: MistakeSignals): MistakeCause | null {
  if (signals.timeLimitMs && signals.durationMs >= signals.timeLimitMs) {
    return "time";
  }

  if (signals.durationMs < estimateReadingMs(signals.questionText) * GUESS_READING_SHARE) {
    return "guess";
  }

  const standing = getSkillStanding(signals);

  if (standing === "strong") {
    return signals.misconception ? "trap" : "misread";
  }

  return standing === "weak" ? "gap" : null;
}
