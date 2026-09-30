import { type WrittenLesson, type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { type CourseLevel } from "@zoonk/db";

/** Subjects where a wrong lesson can hurt: numbers, science, law and health. */
const HIGH_STAKES_CATEGORIES: ReadonlySet<string> = new Set(["health", "law", "math", "science"]);

/**
 * The share of other lessons a reviewer reads, so quality is measured
 * everywhere at a fraction of the cost.
 */
const SAMPLE_RATE = 0.2;

const INLINE_MATH = /\$[^$]+\$/u;

type ReasoningCheckReason = "advanced" | "exam" | "highStakesSubject" | "math" | "sample";

function screenHasMath(screen: WrittenScreen): boolean {
  switch (screen.kind) {
    case "mathCheck":
      return true;
    case "workedExample":
      return screen.steps.some((step) => step.math !== null || INLINE_MATH.test(step.text));
    case "explanation":
      return INLINE_MATH.test(screen.text);
    case "activity":
    case "check":
    case "hookGuess":
    case "hookText":
    case "typedAnswer":
      return false;
    default:
      throw new Error("Unknown written screen kind.");
  }
}

/**
 * Whether a lesson gets the cross-family reasoning check, and why: every
 * advanced lesson, every lesson for an exam, every lesson in a high-stakes
 * subject or with math, and a random sample of the rest. Null means code
 * checks alone decide.
 */
export function getReasoningCheckReason({
  categories,
  forExam,
  lesson,
  level,
  random = Math.random,
}: {
  categories: readonly string[];
  forExam: boolean;
  lesson: WrittenLesson;
  level: CourseLevel;
  random?: () => number;
}): ReasoningCheckReason | null {
  if (level === "advanced") {
    return "advanced";
  }

  if (forExam) {
    return "exam";
  }

  if (categories.some((category) => HIGH_STAKES_CATEGORIES.has(category))) {
    return "highStakesSubject";
  }

  if (lesson.screens.some((screen) => screenHasMath(screen))) {
    return "math";
  }

  return random() < SAMPLE_RATE ? "sample" : null;
}
