import { type MasteryState, type MistakeCause } from "@zoonk/db";

export type MistakeSignals = {
  dontKnow?: boolean;
  durationMs: number;
  questionText: string;
  /** Set for timed activities (mocks, timed drills). */
  timeLimitMs?: number | null;
  misconception?: string | null;
  /** Excludes the current answer. */
  recentSkillAnswers: { correct: number; total: number };
  skillState: MasteryState;
};

const READING_WORDS_PER_MINUTE = 250;
const MS_PER_MINUTE = 60_000;
const MIN_READING_MS = 1500;

const GUESS_READING_SHARE = 0.5;

const MIN_ANSWERS_FOR_ACCURACY = 3;
const STRONG_ACCURACY = 0.8;
const WEAK_ACCURACY = 0.5;

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

/** Null means ambiguous evidence requiring the classifier; time and reading-speed facts take precedence. */
export function inferMistakeCause(signals: MistakeSignals): MistakeCause | null {
  if (signals.timeLimitMs && signals.durationMs >= signals.timeLimitMs) {
    return "time";
  }

  if (signals.dontKnow) {
    return "gap";
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
