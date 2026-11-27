"use client";

import { type LevelTestResult } from "@zoonk/core/language/level-test/contract";
import { Button } from "@zoonk/ui/components/button";
import { getLanguageNameInSentence } from "@zoonk/utils/languages";
import { isValidLocale } from "@zoonk/utils/locale";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { useAppLocale } from "../../_utils/locale";
import { useLanguageNameInSentence } from "../../_utils/use-language-name";
import { OnboardingDescription } from "../../onboarding/onboarding-frame";
import { TestOutcome } from "../../onboarding/test-outcome";
import { UpNextLesson, useResultAction } from "../../placement-test/placement-test-screens";
import { type TestPressed } from "../../placement-test/test-offer";
import { useSkippedLessonsSentences } from "../../plan/use-skipped-lessons-sentences";
import { useResultUndo } from "../../questions/undo-button";
import { LevelRanges } from "./level-test-parts";
import { type TestOutView } from "./level-test-phase";

export type OwnLanguage = { language: string; onSwitch: (language: string) => void };

/** Offered once the learner has seen their level, only where the app isn't in their language yet. */
function InterfaceOffer({ language, onSwitch }: OwnLanguage) {
  const t = useExtracted();
  const locale = useAppLocale();

  if (language === locale || !isValidLocale(language)) {
    return null;
  }

  return (
    <Button
      className="self-start"
      lang={language}
      onClick={() => onSwitch(language)}
      type="button"
      variant="link"
    >
      {t("Use the app in {language}", {
        language: getLanguageNameInSentence({ targetLanguage: language, userLanguage: language }),
      })}
    </Button>
  );
}

export function LevelResult({
  failed,
  onDone,
  onStartLesson,
  onTestOut,
  onUndo,
  onboarding,
  ownLanguage,
  pressed,
  rail,
  result,
  targetLanguage,
  testOutLevel,
}: {
  failed: boolean;
  onDone: () => void;
  onStartLesson: (lessonId: string) => void;
  onTestOut: (level: string) => void;
  onUndo: (changeId: string) => Promise<boolean>;
  onboarding: boolean;
  ownLanguage?: OwnLanguage;
  pressed: TestPressed;
  rail?: ReactNode;
  result: LevelTestResult | null;
  targetLanguage: string;
  testOutLevel: string | null;
}) {
  const t = useExtracted();
  const languageName = useLanguageNameInSentence();
  const { skipped } = useSkippedLessonsSentences();
  const { button, pending, undone } = useResultUndo({ changeId: result?.changeId, onUndo });
  const nextLesson = undone ? null : result?.nextLesson;
  const action = useResultAction({ nextLesson, onboarding });
  const { lessonId } = action;

  return (
    <TestOutcome
      busy={pressed === "main"}
      continueLabel={action.label}
      disabled={pending || pressed === "other"}
      failed={failed}
      lead={<LevelResultLead result={result} undone={undone} />}
      onContinue={lessonId ? () => onStartLesson(lessonId) : onDone}
      other={button(pressed !== null)}
      rail={rail}
      title={
        undone ? skipped(0) : t("Your {language} level", { language: languageName(targetLanguage) })
      }
    >
      {result && <LevelRanges ranges={result.ranges} />}
      {nextLesson && <UpNextLesson title={nextLesson.title} />}
      {testOutLevel && (
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
      {ownLanguage && <InterfaceOffer {...ownLanguage} />}
    </TestOutcome>
  );
}

function useLevelResultSentence() {
  const t = useExtracted();

  return (result: LevelTestResult | null): string => {
    const lessons = result?.lessonsSkipped ?? 0;

    if (lessons > 0) {
      return t(
        "{lessons, plural, one {Skipped # lesson you already know.} other {Skipped # lessons you already know.}}",
        { lessons },
      );
    }

    return result?.ranges.reading && !result.ranges.listening
      ? t("You can test your listening later, from your plan.")
      : t("Your lessons keep adjusting as you answer.");
  };
}

function LevelResultLead({ result, undone }: { result: LevelTestResult | null; undone: boolean }) {
  const { back } = useSkippedLessonsSentences();
  const sentence = useLevelResultSentence();

  return (
    <OnboardingDescription role="status">
      {undone ? back(result?.lessonsSkipped ?? 0) : sentence(result)}
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
  pressed: TestPressed;
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
