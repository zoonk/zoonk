"use client";

import { useExtracted } from "next-intl";
import { useState } from "react";
import { Eyebrow } from "../_components/eyebrow";
import { Surface } from "../_components/surface";
import { useFormatDuration } from "../_utils/time-format";
import { ChoiceList } from "../onboarding/choice-list";
import {
  OnboardingActions,
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
  OnboardingTitle,
} from "../onboarding/onboarding-frame";
import { TestOutcome } from "../onboarding/test-outcome";
import { useSkippedLessonsSentences } from "../plan/use-skipped-lessons-sentences";
import { type ResultUndo, useResultUndo } from "../questions/undo-button";
import { type PlacementLength } from "./placement-test-actions";
import { type PlacementPressed } from "./use-placement-test";

const QUICK_TEST_MINUTES = 4;

function useMinutesLeft() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return (minutes: number) =>
    t({
      description: "{time} is a duration with its unit, such as “15 min”.",
      message: "About {time} left. Your answers are saved.",
      values: { time: formatDuration(minutes) },
    });
}

type TestChoice = PlacementLength | "testOut";

export function PlacementLengthChoice({
  children,
  failed,
  initialChoice = "quick",
  onSkip,
  onStart,
  onTestOut,
  pressed,
  testOutLevel = null,
  wholeCourseMinutes,
}: {
  children?: React.ReactNode;
  failed: boolean;
  initialChoice?: TestChoice;
  onSkip?: () => void;
  onStart: (length: PlacementLength) => void;
  onTestOut?: () => void;
  pressed: PlacementPressed;
  /** A language course's next level the learner can test out of, offered beside the two lengths. */
  testOutLevel?: string | null;
  wholeCourseMinutes: number;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const [choice, setChoice] = useState<TestChoice>(initialChoice);

  const start = () => {
    if (choice === "testOut") {
      onTestOut?.();
      return;
    }

    onStart(choice);
  };

  return (
    <OnboardingColumn
      bar={
        <OnboardingActions failed={failed}>
          {onSkip && (
            <OnboardingSecondaryButton
              busy={pressed === "other"}
              disabled={pressed === "main"}
              onClick={onSkip}
            >
              {t("Skip")}
            </OnboardingSecondaryButton>
          )}
          <OnboardingPrimaryButton
            busy={pressed === "main"}
            disabled={pressed === "other"}
            onClick={start}
          >
            {t("Start")}
          </OnboardingPrimaryButton>
        </OnboardingActions>
      }
    >
      <OnboardingHeading>
        <OnboardingTitle>{t("How much do you want to check?")}</OnboardingTitle>
      </OnboardingHeading>

      <ChoiceList
        choices={[
          {
            description: t("About {time}", { time: formatDuration(QUICK_TEST_MINUTES) }),
            label: t({
              description: "The short placement test: about four minutes of questions.",
              message: "Quick",
            }),
            value: "quick",
          },
          ...(wholeCourseMinutes > 0
            ? [
                {
                  description: t({
                    description:
                      "{time} is a duration with its unit, such as “30 min”. The test is split into parts the learner can take on different days.",
                    message: "About {time}, in parts",
                    values: { time: formatDuration(wholeCourseMinutes) },
                  }),
                  label: t({
                    description:
                      "The long placement test: it checks every topic still ahead in the course.",
                    message: "Whole course",
                  }),
                  value: "wholeCourse" as const,
                },
              ]
            : []),
          ...(testOutLevel && onTestOut
            ? [
                {
                  description: t("Skip {level} if you already know it", { level: testOutLevel }),
                  label: t({
                    description: "A short test of one language level, such as “Test out of B2”.",
                    message: "Test out of {level}",
                    values: { level: testOutLevel },
                  }),
                  value: "testOut" as const,
                },
              ]
            : []),
        ]}
        label={t("How much do you want to check?")}
        onChange={setChoice}
        value={choice}
      />

      <p className="text-muted-foreground text-sm text-pretty">
        {t("Stop any time. Lessons you already know stay skipped.")}
      </p>
      {children}
    </OnboardingColumn>
  );
}

/** A whole-course test between two parts: what the last one skipped, and the rest to do. */
export function PlacementBetweenParts({
  failed,
  lessonsSkipped,
  minutesLeft,
  onContinueOnboarding,
  onFinishForToday,
  onKeepGoing,
  pressed,
  undo,
}: {
  failed: boolean;
  /** Null when the learner came back to a test whose part closed earlier. */
  lessonsSkipped: number | null;
  minutesLeft: number;
  onContinueOnboarding?: () => void;
  onFinishForToday: () => void;
  onKeepGoing?: () => void;
  pressed: PlacementPressed;
  undo: ResultUndo;
}) {
  const t = useExtracted();
  const sentences = useSkippedLessonsSentences();
  const left = useMinutesLeft();
  const { button, pending, undone } = useResultUndo(undo);

  return (
    <OnboardingColumn
      bar={
        <OnboardingActions failed={failed}>
          {button(pressed !== null)}
          {!onContinueOnboarding && (
            <OnboardingSecondaryButton
              busy={pressed === "other"}
              disabled={pending || pressed === "main"}
              onClick={onFinishForToday}
            >
              {t("Finish for today")}
            </OnboardingSecondaryButton>
          )}
          <OnboardingPrimaryButton
            autoFocus
            busy={pressed === "main"}
            disabled={pending || pressed === "other"}
            onClick={onContinueOnboarding ?? onKeepGoing}
          >
            {onContinueOnboarding ? t("Continue") : t("Keep going")}
          </OnboardingPrimaryButton>
        </OnboardingActions>
      }
    >
      <OnboardingHeading>
        <OnboardingTitle>
          {lessonsSkipped === null
            ? t("Continue your test")
            : sentences.skipped(undone ? 0 : lessonsSkipped)}
        </OnboardingTitle>
        <OnboardingDescription>{left(minutesLeft)}</OnboardingDescription>
      </OnboardingHeading>
      {undone && <p role="status">{sentences.back(lessonsSkipped ?? 0)}</p>}
      {onContinueOnboarding && (
        <p className="text-muted-foreground text-sm text-pretty">
          {t("You can finish the test from Plan.")}
        </p>
      )}
    </OnboardingColumn>
  );
}

export function PlacementResult({
  failed,
  length,
  lessonsSkipped,
  nextTopic,
  onDone,
  onboarding = false,
  pressed,
  undo,
}: {
  failed: boolean;
  length: PlacementLength;
  lessonsSkipped: number;
  nextTopic: string | null;
  onDone: () => void;
  onboarding?: boolean;
  pressed: PlacementPressed;
  undo: ResultUndo;
}) {
  const t = useExtracted();
  const sentences = useSkippedLessonsSentences();
  const { button, pending, undone } = useResultUndo(undo);

  return (
    <TestOutcome
      busy={pressed === "main"}
      continueLabel={onboarding ? t("Continue") : t("Done")}
      disabled={pending}
      failed={failed}
      lead={
        <OnboardingDescription role="status">
          {undone && sentences.back(lessonsSkipped)}
          {!undone &&
            (lessonsSkipped > 0 ? sentences.known(lessonsSkipped) : t("Your plan stays as it is."))}
        </OnboardingDescription>
      }
      onContinue={onDone}
      other={button(pressed !== null)}
      title={sentences.skipped(undone ? 0 : lessonsSkipped)}
    >
      {nextTopic && !undone && (
        <Surface className="flex flex-col gap-1 p-4">
          <Eyebrow className="self-start">{t("Up next")}</Eyebrow>
          <p className="font-medium">{nextTopic}</p>
        </Surface>
      )}

      {length === "quick" && !onboarding && (
        <p className="text-muted-foreground text-sm text-pretty">
          {t("The whole-course test can skip more.")}
        </p>
      )}
    </TestOutcome>
  );
}
