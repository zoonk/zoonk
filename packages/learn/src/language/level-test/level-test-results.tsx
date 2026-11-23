"use client";

import {
  type LevelTestLength,
  type LevelTestResult,
} from "@zoonk/core/language/level-test/contract";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { useLanguageNameInSentence } from "../../_utils/use-language-name";
import { OnboardingDescription } from "../../onboarding/onboarding-frame";
import { TestOutcome } from "../../onboarding/test-outcome";
import { type PlacementPressed } from "../../placement-test/use-placement-test";
import { useSkippedLessonsSentences } from "../../plan/use-skipped-lessons-sentences";
import { useResultUndo } from "../../questions/undo-button";
import { LevelRanges } from "./level-test-parts";
import { type TestOutView } from "./use-language-plan-test";

export function LevelResult({
  failed,
  length,
  onDone,
  onTestOut,
  onUndo,
  onWalkTopics,
  onboarding = false,
  pressed,
  rail,
  result,
  targetLanguage,
  testOutLevel,
}: {
  failed: boolean;
  length: LevelTestLength;
  onDone: () => void;
  onTestOut: (level: string) => void;
  onUndo: (changeId: string) => Promise<boolean>;
  onboarding?: boolean;
  onWalkTopics: () => void;
  pressed: PlacementPressed;
  rail?: ReactNode;
  result: LevelTestResult | null;
  targetLanguage: string;
  testOutLevel: string | null;
}) {
  const t = useExtracted();
  const languageName = useLanguageNameInSentence();
  const walks = length === "wholeCourse" && result?.wholeCourseReady === true;
  const { skipped } = useSkippedLessonsSentences();

  const { button, pending, undone } = useResultUndo({ changeId: result?.changeId, onUndo });

  const doneLabel = onboarding ? t("Continue") : t("Done");

  return (
    <TestOutcome
      busy={pressed === "main"}
      continueLabel={walks ? t("Keep going") : doneLabel}
      disabled={pending || pressed === "other"}
      failed={failed}
      lead={<LevelResultLead result={result} undone={undone} />}
      onContinue={walks ? onWalkTopics : onDone}
      other={button(pressed !== null)}
      rail={rail}
      title={
        undone ? skipped(0) : t("Your {language} level", { language: languageName(targetLanguage) })
      }
    >
      {result && <LevelRanges ranges={result.ranges} />}
      {!walks && testOutLevel && (
        <Button
          busy={pressed === "other"}
          className="self-start"
          disabled={pending || pressed === "main"}
          onClick={() => onTestOut(testOutLevel)}
          type="button"
          variant="link"
        >
          {t("Test out of {level}", { level: testOutLevel })}
        </Button>
      )}
    </TestOutcome>
  );
}

function LevelResultLead({ result, undone }: { result: LevelTestResult | null; undone: boolean }) {
  const t = useExtracted();
  const { back } = useSkippedLessonsSentences();
  const skipped = result?.levelsSkipped ?? [];
  const lessons = result?.lessonsSkipped ?? 0;

  return (
    <OnboardingDescription role="status">
      {undone && back(lessons)}
      {!undone &&
        (skipped.length > 0
          ? t({
              description:
                "{levels} is a list of language levels, such as “A1 and A2”. The plan no longer has their lessons.",
              message:
                "{count, plural, one {We skipped {levels}: # lesson.} other {We skipped {levels}: # lessons.}}",
              values: { count: lessons, levels: skipped.join(", ") },
            })
          : t("Your lessons keep adjusting as you answer."))}
    </OnboardingDescription>
  );
}

export function TestOutResult({
  onDone,
  onUndo,
  pressed,
  view,
}: {
  onDone: () => void;
  onUndo: (changeId: string) => Promise<boolean>;
  pressed: PlacementPressed;
  view: TestOutView;
}) {
  const t = useExtracted();
  const lessons = view.result?.lessonsSkipped ?? 0;
  const sentences = useSkippedLessonsSentences();
  const unchecked = view.total === 0;

  const { button, pending, undone } = useResultUndo({
    changeId: lessons > 0 ? view.result?.changeId : null,
    onUndo,
  });

  return (
    <TestOutcome
      busy={pressed === "main"}
      continueLabel={t("Done")}
      disabled={pending}
      lead={
        <OnboardingDescription role="status">
          {undone && sentences.back(lessons)}
          {unchecked && t("There aren't enough questions for {level} yet.", { level: view.level })}
          {!undone && !unchecked && lessons > 0 && sentences.known(lessons)}
          {!unchecked && lessons === 0 && t("Your lessons keep adjusting as you answer.")}
        </OnboardingDescription>
      }
      onContinue={onDone}
      other={button(pressed !== null)}
      title={
        lessons > 0
          ? sentences.skipped(undone ? 0 : lessons)
          : t("{level} stays in your plan", { level: view.level })
      }
    />
  );
}
