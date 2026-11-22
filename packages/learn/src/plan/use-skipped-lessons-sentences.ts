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
      t({
        description:
          'After a test: "it" or "them" is the lessons the test skipped. They stay in the learner\'s practice reviews.',
        message:
          "{count, plural, one {You already know it. It stays in your practice.} other {You already know them. They stay in your practice.}}",
        values: { count },
      }),
    skipped: (count: number) =>
      t({
        description: "The title after a placement test: how many lessons it took out of the plan.",
        message:
          "{count, plural, =0 {No lessons skipped} one {# lesson skipped} other {# lessons skipped}}",
        values: { count },
      }),
  };
}
