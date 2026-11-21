import { useExtracted } from "next-intl";

/** What a test that skipped lessons says about them, before and after the learner undoes it. */
export function useSkippedLessonsSentences() {
  const t = useExtracted();

  return {
    back: (count: number) =>
      t(
        "{count, plural, one {The lesson is back in your plan.} other {The lessons are back in your plan.}}",
        { count },
      ),
    known: (count: number) =>
      t(
        "{count, plural, one {You already know it. It stays in your practice.} other {You already know them. They stay in your practice.}}",
        { count },
      ),
  };
}
