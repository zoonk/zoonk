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

export function PlacementLengthChoice({
  failed,
  onStart,
  pressed,
  wholeCourseMinutes,
}: {
  failed: boolean;
  onStart: (length: PlacementLength) => void;
  pressed: PlacementPressed;
  wholeCourseMinutes: number;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const [length, setLength] = useState<PlacementLength>("quick");

  return (
    <OnboardingColumn
      bar={
        <OnboardingActions failed={failed}>
          <OnboardingPrimaryButton busy={pressed === "main"} onClick={() => onStart(length)}>
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
            value: "wholeCourse",
          },
        ]}
        label={t("How much do you want to check?")}
        onChange={setLength}
        value={length}
      />

      <p className="text-muted-foreground text-sm text-pretty">
        {t("Stop any time. What you pass stays skipped.")}
      </p>
    </OnboardingColumn>
  );
}

function useSkippedTitle() {
  const t = useExtracted();

  return (count: number) =>
    t({
      description: "The title after a placement test: how many lessons it took out of the plan.",
      message:
        "{count, plural, =0 {No lessons skipped} one {# lesson skipped} other {# lessons skipped}}",
      values: { count },
    });
}

/** A whole-course test between two parts: what the last one skipped, and the rest to do. */
export function PlacementBetweenParts({
  failed,
  lessonsSkipped,
  minutesLeft,
  onFinishForToday,
  onKeepGoing,
  pressed,
}: {
  failed: boolean;
  /** Null when the learner came back to a test whose part closed earlier. */
  lessonsSkipped: number | null;
  minutesLeft: number;
  onFinishForToday: () => void;
  onKeepGoing: () => void;
  pressed: PlacementPressed;
}) {
  const t = useExtracted();
  const skippedTitle = useSkippedTitle();
  const left = useMinutesLeft();

  return (
    <OnboardingColumn
      bar={
        <OnboardingActions failed={failed}>
          <OnboardingSecondaryButton
            busy={pressed === "other"}
            disabled={pressed === "main"}
            onClick={onFinishForToday}
          >
            {t("Finish for today")}
          </OnboardingSecondaryButton>
          <OnboardingPrimaryButton
            autoFocus
            busy={pressed === "main"}
            disabled={pressed === "other"}
            onClick={onKeepGoing}
          >
            {t("Keep going")}
          </OnboardingPrimaryButton>
        </OnboardingActions>
      }
    >
      <OnboardingHeading>
        <OnboardingTitle>
          {lessonsSkipped === null ? t("Continue your test") : skippedTitle(lessonsSkipped)}
        </OnboardingTitle>
        <OnboardingDescription>{left(minutesLeft)}</OnboardingDescription>
      </OnboardingHeading>
    </OnboardingColumn>
  );
}

export function PlacementResult({
  failed,
  length,
  lessonsSkipped,
  nextTopic,
  onDone,
  pressed,
}: {
  failed: boolean;
  length: PlacementLength;
  lessonsSkipped: number;
  nextTopic: string | null;
  onDone: () => void;
  pressed: PlacementPressed;
}) {
  const t = useExtracted();
  const skippedTitle = useSkippedTitle();

  return (
    <TestOutcome
      busy={pressed === "main"}
      continueLabel={t("Done")}
      failed={failed}
      lead={
        <OnboardingDescription>
          {lessonsSkipped > 0
            ? t("You already know them. They stay in your practice.")
            : t("Your plan stays as it is.")}
        </OnboardingDescription>
      }
      onContinue={onDone}
      title={skippedTitle(lessonsSkipped)}
    >
      {nextTopic && (
        <Surface className="flex flex-col gap-1 p-4">
          <Eyebrow className="self-start">{t("Up next")}</Eyebrow>
          <p className="font-medium">{nextTopic}</p>
        </Surface>
      )}

      {length === "quick" && (
        <p className="text-muted-foreground text-sm text-pretty">
          {t("The whole-course test can skip more.")}
        </p>
      )}
    </TestOutcome>
  );
}
