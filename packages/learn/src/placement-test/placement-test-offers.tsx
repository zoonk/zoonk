"use client";

import { useExtracted } from "next-intl";
import { TestOffer, type TestOfferCard, type TestPressed } from "./test-offer";
import { type TestFactsNow, type TestRowId } from "./use-test-analytics";
import { useTestFacts } from "./use-test-facts";

/** What the course's test asks before it starts; null when the server has nothing to say. */
export type CourseTestOffer = { estimatedMinutes: number; questions: number } | null;

/** The cards an offer put on screen, by their stable ids, the one that came picked and its count. */
export type OfferedRows = Pick<TestFactsNow, "questions"> & {
  preselected: TestRowId;
  rows: readonly TestRowId[];
};

/** The words and cards every test's offer shares. */
export function useTestOfferTexts() {
  const t = useExtracted();
  const facts = useTestFacts();

  return {
    /** The other way to start, by the lesson's name where onboarding knows it. */
    firstLesson: (title: string | null): TestOfferCard<"firstLesson"> => ({
      label: t("First lesson"),
      line: title,
      mark: "lesson",
      value: "firstLesson",
    }),
    lessonsLine: t("A test finds the lessons you can skip."),
    skipTitle: t("Skip what you already know"),
    startTitle: t("Where would you like to start?"),
    /** A test's card: the most it asks, and how long it takes as the card's readout. */
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

/** Onboarding's offer: the test, picked, or the first lesson. */
export function CourseStartOffer({
  failed,
  firstLesson,
  offer,
  onFirstLesson,
  onShown,
  onStart,
  pressed,
}: {
  failed: boolean;
  /** The first lesson's name, where onboarding knows it. */
  firstLesson: string | null;
  offer: CourseTestOffer;
  onFirstLesson: () => void;
  onShown: (offered: OfferedRows) => void;
  onStart: () => void;
  pressed: TestPressed;
}) {
  const t = useExtracted();
  const texts = useTestOfferTexts();
  const test = useCourseCard(offer);

  return (
    <TestOffer<"firstLesson" | "test">
      cards={[test, texts.firstLesson(firstLesson)]}
      description={texts.lessonsLine}
      failed={failed}
      initial="test"
      mainLabel={(choice) => (choice === "firstLesson" ? t("Continue") : t("Start"))}
      onShown={() =>
        onShown({
          preselected: "quick",
          questions: offer?.questions ?? null,
          rows: ["quick", "first_lesson"],
        })
      }
      onStart={(choice) => (choice === "firstLesson" ? onFirstLesson() : onStart())}
      pressed={pressed}
      title={texts.startTitle}
    />
  );
}

/** The Plan's offer: the test's card and the way in. */
export function CoursePlanOffer({
  failed,
  offer,
  onNotNow,
  onShown,
  onStart,
  pressed,
}: {
  failed: boolean;
  offer: CourseTestOffer;
  onNotNow: () => void;
  onShown: (offered: OfferedRows) => void;
  onStart: () => void;
  pressed: TestPressed;
}) {
  const t = useExtracted();
  const texts = useTestOfferTexts();
  const test = useCourseCard(offer);

  return (
    <TestOffer
      cards={[test]}
      description={texts.lessonsLine}
      failed={failed}
      initial="test"
      onShown={() =>
        onShown({ preselected: "quick", questions: offer?.questions ?? null, rows: ["quick"] })
      }
      onStart={onStart}
      other={{ label: t("Not now"), onPress: onNotNow }}
      pressed={pressed}
      title={texts.skipTitle}
    />
  );
}
