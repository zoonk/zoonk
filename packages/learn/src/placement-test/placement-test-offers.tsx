"use client";

import { useExtracted } from "next-intl";
import { TestOffer, type TestOfferCard, type TestPressed } from "./test-offer";
import { type TestFactsNow, type TestRowId } from "./use-test-analytics";
import { useTestFacts } from "./use-test-facts";

/** Null when the course has no test to start. */
export type CourseTestOffer = { estimatedMinutes: number; questions: number } | null;

export type OfferedRows = Pick<TestFactsNow, "questions"> & {
  preselected: TestRowId;
  rows: readonly TestRowId[];
};

export function useTestOfferTexts() {
  const t = useExtracted();
  const facts = useTestFacts();

  return {
    firstLesson: (title: string | null): TestOfferCard<"firstLesson"> => ({
      label: t("First lesson"),
      line: title,
      mark: "lesson",
      value: "firstLesson",
    }),
    lessonsLine: t("A test finds the lessons you can skip."),
    skipTitle: t("Skip what you already know"),
    startTitle: t("Where would you like to start?"),
    test: <Value extends string>({
      label,
      minutes,
      questions,
      value,
    }: {
      label: string;
      minutes: number | null;
      questions: number | null;
      value: Value;
    }): TestOfferCard<Value> => ({
      label,
      line: questions === null ? null : facts.upToQuestions(questions),
      mark: "test",
      minutes,
      value,
    }),
  };
}

function useCourseCard(offer: CourseTestOffer): TestOfferCard<"test"> {
  const t = useExtracted();
  const texts = useTestOfferTexts();

  return texts.test({
    label: t({
      description: "The name of a course's placement test, on the card that offers it.",
      message: "Test",
    }),
    minutes: offer?.estimatedMinutes ?? null,
    questions: offer?.questions ?? null,
    value: "test",
  });
}

type OnboardingWay = { firstLessonTitle: string | null; onFirstLesson: () => void };
type PlanWay = { onNotNow: () => void };

/** Onboarding offers the test, picked, beside the first lesson; the Plan offers it alone. */
export function CourseOffer({
  failed,
  offer,
  onShown,
  onStart,
  pressed,
  ...way
}: {
  failed: boolean;
  offer: CourseTestOffer;
  onShown: (offered: OfferedRows) => void;
  onStart: () => void;
  pressed: TestPressed;
} & (OnboardingWay | PlanWay)) {
  const t = useExtracted();
  const texts = useTestOfferTexts();
  const test = useCourseCard(offer);
  const onboarding = "onFirstLesson" in way ? way : null;

  return (
    <TestOffer<"firstLesson" | "test">
      cards={onboarding ? [test, texts.firstLesson(onboarding.firstLessonTitle)] : [test]}
      description={texts.lessonsLine}
      failed={failed}
      initial="test"
      mainLabel={(choice) => (choice === "firstLesson" ? t("Continue") : t("Start"))}
      onShown={() =>
        onShown({
          preselected: "quick",
          questions: offer?.questions ?? null,
          rows: onboarding ? ["quick", "first_lesson"] : ["quick"],
        })
      }
      onStart={(choice) =>
        choice === "firstLesson" && onboarding ? onboarding.onFirstLesson() : onStart()
      }
      other={"onNotNow" in way ? { label: t("Not now"), onPress: way.onNotNow } : undefined}
      pressed={pressed}
      title={onboarding ? texts.startTitle : texts.skipTitle}
    />
  );
}
