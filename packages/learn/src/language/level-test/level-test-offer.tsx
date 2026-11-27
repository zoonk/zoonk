"use client";

import { useExtracted } from "next-intl";
import { useTestOfferTexts } from "../../placement-test/placement-test-offers";
import { TestInvitation, TestOffer } from "../../placement-test/test-offer";
import { type TestAnalytics, type TestRowId } from "../../placement-test/use-test-analytics";
import { useTestFacts } from "../../placement-test/use-test-facts";
import { type LevelTestOffer } from "./level-test-phase";
import { type useLanguagePlanTest } from "./use-language-plan-test";

type OfferChoice = "firstLesson" | "levelTest" | "testOut";

/** Onboarding offers the test beside a first lesson; the Plan offers it alone or beside a test-out. */
export function LevelTestOfferStep({
  analytics,
  levelGiven,
  offer,
  onStartTestOut,
  onboarding,
  test,
  testOutFirst,
  testOutLevel,
}: {
  analytics: TestAnalytics;
  levelGiven: boolean;
  offer: LevelTestOffer;
  onStartTestOut: (level: string) => void;
  onboarding: boolean;
  test: ReturnType<typeof useLanguagePlanTest>;
  testOutFirst: boolean;
  testOutLevel: string | null;
}) {
  const t = useExtracted();
  const texts = useTestOfferTexts();
  const facts = useTestFacts();
  const { failed, pressed } = test;

  const shown = (rows: readonly TestRowId[], preselected: TestRowId = "quick") =>
    analytics.offered({ preselected, questions: offer.total, rows });

  const levelTest = {
    facts: [facts.upToQuestions(offer.total), facts.about(offer.estimatedMinutes)],
    label: t("Level test"),
    value: "levelTest",
  } as const;

  if (onboarding) {
    return (
      <TestOffer<OfferChoice>
        description={texts.lessonsLine}
        failed={failed}
        initial="levelTest"
        mainLabel={(choice) => (choice === "firstLesson" ? t("Continue") : t("Start"))}
        onShown={() => shown(["first_lesson", "quick"])}
        onStart={(choice) => (choice === "firstLesson" ? test.onLeave("main") : test.onStart())}
        pressed={pressed}
        rows={[texts.firstLesson(levelGiven), levelTest]}
        title={texts.startTitle}
      />
    );
  }

  const other = {
    label: t("Not now"),
    onPress: () => {
      analytics.notNow({ questions: offer.total });
      test.onLeave("other");
    },
  };

  if (!testOutLevel) {
    return (
      <TestInvitation
        chip={levelTest.label}
        description={texts.lessonsLine}
        facts={levelTest.facts}
        failed={failed}
        onShown={() => shown(["quick"])}
        onStart={test.onStart}
        other={other}
        pressed={pressed}
        title={texts.skipTitle}
      />
    );
  }

  return (
    <TestOffer<OfferChoice>
      description={texts.lessonsLine}
      failed={failed}
      initial={testOutFirst ? "testOut" : "levelTest"}
      onShown={() => shown(["quick", "test_out"], testOutFirst ? "test_out" : "quick")}
      onStart={(choice) => (choice === "testOut" ? onStartTestOut(testOutLevel) : test.onStart())}
      other={other}
      pressed={pressed}
      rows={[
        levelTest,
        {
          facts: [t("Skip {level} if you already know it", { level: testOutLevel })],
          label: t({
            description: "A short test of one language level, such as “Test out of B2”.",
            message: "Test out of {level}",
            values: { level: testOutLevel },
          }),
          value: "testOut",
        },
      ]}
      title={texts.skipTitle}
    />
  );
}
