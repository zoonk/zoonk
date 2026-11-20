import { type PreparedFix } from "./prepare-content-fix";

const MAX_REVIEW_UNITS = 10;

export function reviewBudgetProblem(fix: PreparedFix): string | null {
  const units = fix.changes.reduce((total, change) => {
    if (change.model === "LessonWord" || change.model === "LessonSentence") {
      return total;
    }

    if (change.op !== "setScreens") {
      return total + 1;
    }

    const words = change.proposal?.words?.filter((entry) => "key" in entry).length ?? 0;
    const sentences = change.proposal?.sentences?.filter((entry) => "key" in entry).length ?? 0;
    return total + 1 + words + sentences;
  }, fix.media.length);

  return units > MAX_REVIEW_UNITS
    ? `A fix holds up to ${MAX_REVIEW_UNITS} review units. Each change, word or sentence declaration, and newly generated clip, picture or idea icon counts one. Dependent lesson rows for a shared word or sentence count nothing. Split the changes into smaller fixes.`
    : null;
}
