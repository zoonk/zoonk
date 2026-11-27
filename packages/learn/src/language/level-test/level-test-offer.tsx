"use client";

import { useExtracted } from "next-intl";
import { useTestOfferTexts } from "../../placement-test/placement-test-offers";
import { TestOffer, type TestOfferCard } from "../../placement-test/test-offer";
import { type TestAnalytics, type TestRowId } from "../../placement-test/use-test-analytics";
import { type LevelTestOffer } from "./level-test-phase";
import { type useLanguagePlanTest } from "./use-language-plan-test";

type OfferChoice = "firstLesson" | "levelTest" | "testOut";

/** Onboarding offers the test beside a first lesson; the Plan offers it alone or beside a test-out. */
export function LevelTestOfferStep({
  analytics,
  firstLesson,
  offer,
  onStartTestOut,
  onboarding,
  test,
  testOutFirst,
  testOutLevel,
}: {
  analytics: TestAnalytics;
  /** Onboarding's first lesson by its name, where it's known. */
  firstLesson: string | null;
  offer: LevelTestOffer;
  onStartTestOut: (level: string) => void;
  onboarding: boolean;
  test: ReturnType<typeof useLanguagePlanTest>;
  testOutFirst: boolean;
  testOutLevel: string | null;
}) {
  const t = useExtracted();
  const texts = useTestOfferTexts();
  const { failed, pressed } = test;

  const shown = (rows: readonly TestRowId[], preselected: TestRowId = "quick") =>
    analytics.offered({ preselected, questions: offer.total, rows });

  const levelTest = texts.test({
    label: t("Level test"),
    minutes: offer.estimatedMinutes,
    questions: offer.total,
    value: "levelTest",
  });

  if (onboarding) {
    return (
      <TestOffer<OfferChoice>
        cards={[levelTest, texts.firstLesson(firstLesson)]}
        description={texts.lessonsLine}
        failed={failed}
        initial="levelTest"
        mainLabel={(choice) => (choice === "firstLesson" ? t("Continue") : t("Start"))}
        onShown={() => shown(["quick", "first_lesson"])}
        onStart={(choice) => (choice === "firstLesson" ? test.onLeave("main") : test.onStart())}
        pressed={pressed}
        title={texts.startTitle}
      />
    );
  }

  const testOut: TestOfferCard<OfferChoice>[] = testOutLevel
    ? [
        {
          label: t({
            description: "A short test of one language level, such as “Test out of B2”.",
            message: "Test out of {level}",
            values: { level: testOutLevel },
          }),
          line: t("Skip {level} if you already know it", { level: testOutLevel }),
          mark: "test",
          value: "testOut",
        },
      ]
    : [];

  return (
    <TestOffer<OfferChoice>
      cards={[levelTest, ...testOut]}
      description={texts.lessonsLine}
      failed={failed}
      initial={testOutLevel && testOutFirst ? "testOut" : "levelTest"}
      onShown={() =>
        testOutLevel
          ? shown(["quick", "test_out"], testOutFirst ? "test_out" : "quick")
          : shown(["quick"])
      }
      onStart={(choice) =>
        choice === "testOut" && testOutLevel ? onStartTestOut(testOutLevel) : test.onStart()
      }
      other={{
        label: t("Not now"),
        onPress: () => {
          analytics.notNow({ questions: offer.total });
          test.onLeave("other");
        },
      }}
      pressed={pressed}
      title={texts.skipTitle}
    />
  );
}
