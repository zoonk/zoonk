"use client";

import {
  type LevelTestLength,
  type LevelTestResult,
} from "@zoonk/core/language/level-test/contract";
import { useExtracted } from "next-intl";
import { useLanguageNameInSentence } from "../../_utils/use-language-name";
import {
  OnboardingDescription,
  OnboardingSecondaryButton,
} from "../../onboarding/onboarding-frame";
import { TestOutcome } from "../../onboarding/test-outcome";
import { type PlacementPressed } from "../../placement-test/use-placement-test";
import { LevelRanges } from "./level-test-parts";
import { type TestOutView } from "./use-language-plan-test";

export function LevelResult({
  failed,
  length,
  onDone,
  onTestOut,
  onWalkTopics,
  pressed,
  result,
  targetLanguage,
  testOutLevel,
}: {
  failed: boolean;
  length: LevelTestLength;
  onDone: () => void;
  onTestOut: (level: string) => void;
  onWalkTopics: () => void;
  pressed: PlacementPressed;
  result: LevelTestResult | null;
  targetLanguage: string;
  testOutLevel: string | null;
}) {
  const t = useExtracted();
  const languageName = useLanguageNameInSentence();
  const walks = length === "wholeCourse" && result?.wholeCourseReady === true;
  const skipped = result?.levelsSkipped ?? [];

  return (
    <TestOutcome
      busy={pressed === "main"}
      continueLabel={walks ? t("Keep going") : t("Done")}
      disabled={pressed === "other"}
      failed={failed}
      lead={
        <OnboardingDescription>
          {skipped.length > 0
            ? t({
                description:
                  "{levels} is a list of language levels, such as “A1 and A2”. The plan no longer has their lessons.",
                message:
                  "{count, plural, one {We skipped {levels}: # lesson.} other {We skipped {levels}: # lessons.}}",
                values: { count: result?.lessonsSkipped ?? 0, levels: skipped.join(", ") },
              })
            : t("Your lessons keep adjusting as you answer.")}
        </OnboardingDescription>
      }
      onContinue={walks ? onWalkTopics : onDone}
      other={
        !walks &&
        testOutLevel && (
          <OnboardingSecondaryButton
            busy={pressed === "other"}
            disabled={pressed === "main"}
            onClick={() => onTestOut(testOutLevel)}
          >
            {t("Test out of {level}", { level: testOutLevel })}
          </OnboardingSecondaryButton>
        )
      }
      title={t("Your {language} level", { language: languageName(targetLanguage) })}
    >
      {result && <LevelRanges ranges={result.ranges} />}
    </TestOutcome>
  );
}

export function TestOutResult({
  onDone,
  pressed,
  view,
}: {
  onDone: () => void;
  pressed: PlacementPressed;
  view: TestOutView;
}) {
  const t = useExtracted();
  const lessons = view.result?.lessonsSkipped ?? 0;

  return (
    <TestOutcome
      busy={pressed === "main"}
      continueLabel={t("Done")}
      lead={
        <OnboardingDescription>
          {lessons > 0
            ? t("You already know them. They stay in your practice.")
            : t("Your lessons keep adjusting as you answer.")}
        </OnboardingDescription>
      }
      onContinue={onDone}
      title={
        lessons > 0
          ? t(
              "{count, plural, =0 {No lessons skipped} one {# lesson skipped} other {# lessons skipped}}",
              { count: lessons },
            )
          : t("{level} stays in your plan", { level: view.level })
      }
    />
  );
}
