"use client";

import { useExtracted } from "next-intl";
import { type PlacementAttemptView } from "../onboarding/onboarding-actions";
import { type PlacementLength } from "./placement-test-actions";
import { TestInvitation, TestOffer, type TestOfferRow, type TestPressed } from "./test-offer";
import { type TestFactsNow, type TestRowId } from "./use-test-analytics";
import { useTestFacts } from "./use-test-facts";

/** What the course's test asks before it starts; null for a row with nothing to say. */
export type CourseTestOffer = {
  estimatedMinutes: number;
  questions: number;
  wholeCourse: { estimatedMinutes: number; parts: number } | null;
} | null;

type OfferChoice = PlacementLength | "firstLesson";

/** The rows an offer put on screen, by their stable ids, the one that came picked and their counts. */
export type OfferedRows = Pick<TestFactsNow, "parts" | "questions"> & {
  preselected: TestRowId;
  rows: readonly TestRowId[];
};

const COURSE_ROW_IDS: Record<PlacementLength, TestRowId> = {
  quick: "quick",
  wholeCourse: "whole_course",
};

export function useTestOfferTexts() {
  const t = useExtracted();

  return {
    /** Says where it starts only to a learner who told us their level. */
    firstLesson: (levelGiven: boolean) =>
      ({
        facts: levelGiven ? [t("Starts at the level you gave")] : [],
        label: t("First lesson"),
        value: "firstLesson",
      }) as const,
    lessonsLine: t("A test finds the lessons you can skip."),
    skipTitle: t("Skip what you already know"),
    startTitle: t("Where would you like to start?"),
  };
}

export function useFullTestLabel(): string {
  const t = useExtracted();

  return t({
    description: "The long test: it checks every topic still ahead, in parts.",
    message: "Full test",
  });
}

/** The counts the course's rows show; null where the server has none. */
function toOfferCounts(offer: CourseTestOffer): Pick<TestFactsNow, "parts" | "questions"> {
  return { parts: offer?.wholeCourse?.parts ?? null, questions: offer?.questions ?? null };
}

function useCourseRows(offer: CourseTestOffer): TestOfferRow<PlacementLength>[] {
  const t = useExtracted();
  const facts = useTestFacts();
  const fullTest = useFullTestLabel();

  return [
    {
      facts: offer
        ? [facts.upToQuestions(offer.questions), facts.about(offer.estimatedMinutes)]
        : [],
      label: t({
        description: "The short test: about six minutes of questions.",
        message: "Quick test",
      }),
      value: "quick",
    },
    ...(offer?.wholeCourse
      ? [
          {
            facts: [
              facts.partsAnyDay(offer.wholeCourse.parts),
              facts.about(offer.wholeCourse.estimatedMinutes),
            ],
            label: fullTest,
            value: "wholeCourse" as const,
          },
        ]
      : []),
  ];
}

/** Onboarding's offer: a first lesson or a test, the short test picked. */
export function CourseStartOffer({
  failed,
  levelGiven,
  offer,
  onFirstLesson,
  onShown,
  onStart,
  pressed,
}: {
  failed: boolean;
  levelGiven: boolean;
  offer: CourseTestOffer;
  onFirstLesson: () => void;
  onShown: (offered: OfferedRows) => void;
  onStart: (length: PlacementLength) => void;
  pressed: TestPressed;
}) {
  const t = useExtracted();
  const texts = useTestOfferTexts();
  const rows = useCourseRows(offer);

  return (
    <TestOffer<OfferChoice>
      description={texts.lessonsLine}
      failed={failed}
      initial="quick"
      mainLabel={(choice) => (choice === "firstLesson" ? t("Continue") : t("Start"))}
      onShown={() =>
        onShown({
          ...toOfferCounts(offer),
          preselected: "quick",
          rows: ["first_lesson", ...rows.map((row) => COURSE_ROW_IDS[row.value])],
        })
      }
      onStart={(choice) => (choice === "firstLesson" ? onFirstLesson() : onStart(choice))}
      pressed={pressed}
      rows={[texts.firstLesson(levelGiven), ...rows]}
      title={texts.startTitle}
    />
  );
}

/** The Plan's offer: the tests as rows when there are two, the one test alone otherwise. */
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
  onStart: (length: PlacementLength) => void;
  pressed: TestPressed;
}) {
  const t = useExtracted();
  const texts = useTestOfferTexts();
  const rows = useCourseRows(offer);
  const other = { label: t("Not now"), onPress: onNotNow };

  const shown = () =>
    onShown({
      ...toOfferCounts(offer),
      preselected: "quick",
      rows: rows.map((row) => COURSE_ROW_IDS[row.value]),
    });

  if (rows.length > 1) {
    return (
      <TestOffer
        description={texts.lessonsLine}
        failed={failed}
        initial="quick"
        onShown={shown}
        onStart={onStart}
        other={other}
        pressed={pressed}
        rows={rows}
        title={texts.skipTitle}
      />
    );
  }

  return (
    <TestInvitation
      chip={t("Test what you know")}
      description={texts.lessonsLine}
      facts={rows[0]?.facts ?? []}
      failed={failed}
      onShown={shown}
      onStart={() => onStart("quick")}
      other={other}
      pressed={pressed}
      title={texts.skipTitle}
    />
  );
}

/** Back at a full test with parts left: where it stands and the way on. */
export function PlacementContinue({
  attempt,
  failed,
  onContinue,
  onLeave,
  onShown,
  pressed,
}: {
  attempt: PlacementAttemptView;
  failed: boolean;
  onContinue: () => void;
  onLeave: () => void;
  onShown: (offered: OfferedRows) => void;
  pressed: TestPressed;
}) {
  const t = useExtracted();
  const facts = useTestFacts();
  const { parts, resume } = attempt;

  const where = resume
    ? [
        facts.part({ part: resume.part, parts }),
        facts.question({ number: resume.question, total: attempt.questions }),
      ]
    : [
        facts.part({ part: attempt.nextPart ?? attempt.part, parts }),
        facts.aboutLeft(attempt.remainingEstimatedMinutes),
      ];

  return (
    <TestInvitation
      chip={t("Test what you know")}
      facts={where}
      failed={failed}
      mainLabel={t("Continue")}
      onShown={() => onShown({ preselected: "continue", rows: ["continue"] })}
      onStart={onContinue}
      other={{ label: t("Finish later"), onPress: onLeave }}
      pressed={pressed}
      title={t("Continue your test")}
    />
  );
}
