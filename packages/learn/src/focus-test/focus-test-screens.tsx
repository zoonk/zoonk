"use client";

import {
  type FocusTestOffer,
  type FocusTestSitting,
  type FocusTestView,
} from "@zoonk/core/learner/placement/focus-test-contract";
import { PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { BigQuantity } from "../_components/big-quantity";
import { ChangeSaveError } from "../_components/save-error";
import { TaskMeta } from "../_components/task-meta";
import { useSentenceSpace } from "../_utils/locale";
import { useFormatDuration } from "../_utils/time-format";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingFooter,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
  OnboardingSubject,
  OnboardingTitle,
} from "../onboarding/onboarding-frame";
import { FocusTestEvidence, FocusTestResult } from "./focus-test-checkpoint";
import { type SittingEnd } from "./focus-test-phase";
import { type FocusTestPlanActions } from "./focus-test-proposal";
import { FocusTestSubjectsSheet } from "./focus-test-subjects";
import { type Pressed } from "./use-focus-test";
import { useSittingFacts } from "./use-focus-test-texts";

export type FocusTestHost = "onboarding" | "plan";

/** The time is the screen's one big number: it's what decides whether someone starts. */
function SittingSize({ facts, minutes }: { facts: readonly string[]; minutes: number }) {
  const { about } = useSittingFacts();

  return (
    <div className="flex flex-col gap-1.5" data-slot="sitting-size">
      <BigQuantity className="text-4xl leading-none">{about(minutes)}</BigQuantity>
      <TaskMeta facts={facts} />
    </div>
  );
}

function PastCeilingNote({ focusTest, next }: { focusTest: FocusTestView; next: FocusTestOffer }) {
  const t = useExtracted();
  const space = useSentenceSpace();

  if (next.pastCeiling === 0) {
    return null;
  }

  return (
    <p className="text-muted-foreground text-sm text-pretty">
      {t({
        description:
          "“This sitting” is one go at the Focus test, answered in one stretch. It is not a study session, which is a different thing in the app: use another word, or say “this test” or “this time”.",
        message:
          "Your plan considers all {subjects, plural, one {# subject} other {# subjects}}. This sitting has {questions, plural, one {up to # question} other {up to # questions}}, so some subjects may not be checked.",
        values: { questions: next.questions, subjects: focusTest.counts.total },
      })}
      {space}
      <FocusTestSubjectsSheet answered={false} subjects={focusTest.subjects} />
    </p>
  );
}

export function FocusTestInvitation({
  failed,
  focusTest,
  host,
  next,
  onSkip,
  onStart,
  pressed,
  subject,
}: {
  failed: boolean;
  focusTest: FocusTestView;
  host: FocusTestHost;
  next: FocusTestOffer;
  onSkip: () => void;
  onStart: () => void;
  pressed: Pressed;
  subject: string;
}) {
  const t = useExtracted();
  const { upTo } = useSittingFacts();
  const suggestsFocus = focusTest.dated && focusTest.counts.total > 1;

  return (
    <OnboardingColumn>
      <OnboardingHeading>
        <OnboardingSubject>{subject}</OnboardingSubject>
        <OnboardingTitle>
          {focusTest.dated
            ? t("Let's find where your study time should go")
            : t("Find where to start")}
        </OnboardingTitle>
        <OnboardingDescription>
          {suggestsFocus
            ? t(
                "Quick questions on your subjects, the ones that count most first. Your answers help your plan skip what you already know and suggest where to focus.",
              )
            : t(
                "Quick questions on your subjects, the ones that count most first. Your answers help your plan skip what you already know.",
              )}
        </OnboardingDescription>
      </OnboardingHeading>

      <SittingSize
        facts={[
          t("Optional"),
          upTo(next.questions),
          t("{count, plural, one {# subject} other {# subjects}}", {
            count: focusTest.counts.total,
          }),
        ]}
        minutes={next.minutes}
      />

      <div className="flex flex-col gap-1.5 text-sm text-pretty">
        <p>{t("There's no grade. “I don't know yet” is a useful answer.")}</p>
        <p>{t("Stop whenever you need to. We save each answer.")}</p>
      </div>

      <PastCeilingNote focusTest={focusTest} next={next} />

      <OnboardingFooter>
        {failed && <ChangeSaveError />}
        <OnboardingPrimaryButton
          busy={pressed === "main"}
          disabled={pressed === "other"}
          icon={<PlayIcon aria-hidden="true" />}
          onClick={onStart}
        >
          {t("Start the test")}
        </OnboardingPrimaryButton>
        <OnboardingSecondaryButton
          busy={pressed === "other"}
          disabled={pressed === "main"}
          onClick={onSkip}
        >
          {host === "onboarding" ? t("Skip for now") : t("Not now")}
        </OnboardingSecondaryButton>
      </OnboardingFooter>
    </OnboardingColumn>
  );
}

export function FocusTestResume({
  failed,
  onContinue,
  onUseAnswers,
  pressed,
  sitting,
  subject,
}: {
  failed: boolean;
  onContinue: () => void;
  onUseAnswers: () => void;
  pressed: Pressed;
  sitting: FocusTestSitting;
  subject: string;
}) {
  const t = useExtracted();

  return (
    <OnboardingColumn>
      <OnboardingHeading>
        <OnboardingSubject>{subject}</OnboardingSubject>
        <OnboardingTitle>{t("Continue your test")}</OnboardingTitle>
      </OnboardingHeading>

      <SittingSize
        facts={[
          t("{count, plural, one {# answer saved} other {# answers saved}}", {
            count: sitting.answered,
          }),
          t("{count, plural, one {Up to # question left} other {Up to # questions left}}", {
            count: sitting.left,
          }),
        ]}
        minutes={sitting.minutes}
      />

      <OnboardingFooter>
        {failed && <ChangeSaveError />}
        <OnboardingPrimaryButton
          autoFocus
          disabled={pressed === "other"}
          icon={<PlayIcon aria-hidden="true" />}
          onClick={onContinue}
        >
          {t("Continue")}
        </OnboardingPrimaryButton>
        <OnboardingSecondaryButton busy={pressed === "other"} onClick={onUseAnswers}>
          {t("Use my answers")}
        </OnboardingSecondaryButton>
      </OnboardingFooter>
    </OnboardingColumn>
  );
}

/** A sitting that's over and not closed yet: the learner came back to it, or closing it failed. */
export function FocusTestEnded({
  end,
  failed,
  onFinish,
  pending,
  subject,
}: {
  end: SittingEnd | null;
  failed: boolean;
  onFinish: () => void;
  pending: boolean;
  subject: string;
}) {
  const t = useExtracted();

  return (
    <OnboardingColumn>
      <OnboardingHeading>
        <OnboardingSubject>{subject}</OnboardingSubject>
        <OnboardingTitle>{t("Your answers are saved")}</OnboardingTitle>
        {end === "settled" && (
          <OnboardingDescription>{t("Your starting points are set.")}</OnboardingDescription>
        )}
        {end === "noQuestionsReady" && (
          <OnboardingDescription>
            {t("That's all the questions ready for now. Your next sessions ask the rest.")}
          </OnboardingDescription>
        )}
      </OnboardingHeading>

      <OnboardingFooter>
        {failed && <ChangeSaveError />}
        <OnboardingPrimaryButton autoFocus busy={pending} onClick={onFinish}>
          {t("See your starting plan")}
        </OnboardingPrimaryButton>
      </OnboardingFooter>
    </OnboardingColumn>
  );
}

export function FocusTestCheckpoint({
  end,
  failed,
  focusTest,
  host,
  onContinueTest,
  onDone,
  plan,
  pressed,
  subject,
}: {
  end: SittingEnd | null;
  failed: boolean;
  focusTest: FocusTestView;
  host: FocusTestHost;
  onContinueTest: () => void;
  onDone: () => void;
  plan: FocusTestPlanActions | null;
  pressed: Pressed;
  subject: string;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const [proposalAnswered, setProposalAnswered] = useState(false);
  const next = focusTest.offer;

  // One filled button a screen: while a proposal waits, "Update my plan" is it.
  const proposalWaits =
    plan !== null && Boolean(focusTest.checkpoint?.focus?.proposal?.canApply) && !proposalAnswered;

  const DoneButton = proposalWaits ? OnboardingSecondaryButton : OnboardingPrimaryButton;

  return (
    <OnboardingColumn>
      <OnboardingHeading>
        <OnboardingSubject>{subject}</OnboardingSubject>
        <OnboardingTitle>{t("Your starting plan")}</OnboardingTitle>
        <FocusTestEvidence end={end} focusTest={focusTest} />
      </OnboardingHeading>

      <FocusTestResult
        focusTest={focusTest}
        onProposalAnswered={() => setProposalAnswered(true)}
        plan={plan}
      />

      <OnboardingFooter>
        {failed && <ChangeSaveError />}
        <DoneButton
          autoFocus={!proposalWaits}
          busy={pressed === "main"}
          disabled={pressed === "other"}
          onClick={onDone}
        >
          {host === "onboarding" ? t("Continue to daily time") : t("Done")}
        </DoneButton>
        {next && (
          <OnboardingSecondaryButton
            busy={pressed === "other"}
            disabled={pressed === "main"}
            onClick={onContinueTest}
          >
            {t("Continue the test · About {time}", { time: formatDuration(next.minutes) })}
          </OnboardingSecondaryButton>
        )}
      </OnboardingFooter>
    </OnboardingColumn>
  );
}
