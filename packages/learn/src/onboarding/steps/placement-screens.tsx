"use client";

import {
  BookOpenIcon,
  CircleCheckIcon,
  HandIcon,
  SignpostIcon,
  TimerOffIcon,
  TrendingUpIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { toLabelCase } from "../../_utils/label-case";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingFooter,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
  OnboardingSubject,
  OnboardingTitle,
} from "../onboarding-frame";
import { StepIcon, StepPoints } from "./step-parts";

/** An exam's subjects, the ones placement asks about: one per row on phones, where names wrap. */
function SubjectTiles({ subjects }: { subjects: string[] }) {
  const t = useExtracted();

  return (
    <ul aria-label={t("Subjects")} className="grid gap-2 sm:grid-cols-2">
      {subjects.map((name) => (
        <li
          className="bg-muted/60 in-data-[mode=fun]:fun-glass flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium text-pretty"
          key={name}
        >
          <span className="bg-background in-data-[mode=fun]:bg-fun-soft flex size-9 shrink-0 items-center justify-center rounded-xl">
            <BookOpenIcon aria-hidden="true" className="size-4" />
          </span>
          {toLabelCase(name)}
        </li>
      ))}
    </ul>
  );
}

export function PlacementIntro({
  examSubjects,
  onScratch,
  onStart,
  pending,
  subject,
}: {
  examSubjects: string[];
  onScratch: () => void;
  onStart: () => void;
  pending: boolean;
  subject: string;
}) {
  const t = useExtracted();

  const points = [
    { icon: TimerOffIcon, label: t("No timer and no score") },
    { icon: HandIcon, label: t("Stop whenever you like") },
    { icon: TrendingUpIcon, label: t("Your plan keeps adjusting as you learn") },
  ];

  return (
    <OnboardingColumn>
      <OnboardingHeading>
        <OnboardingSubject>{subject}</OnboardingSubject>
        <OnboardingTitle>{t("Let's see what you already know")}</OnboardingTitle>
        <OnboardingDescription>
          {examSubjects.length > 0
            ? t(
                "Quick questions from the {count, number} areas below. They adapt to your answers, so your plan skips what you already know.",
                { count: examSubjects.length },
              )
            : t(
                "A few quick questions. They adapt to your answers, so your plan skips what you already know.",
              )}
        </OnboardingDescription>
      </OnboardingHeading>

      {examSubjects.length > 0 && <SubjectTiles subjects={examSubjects} />}

      <StepPoints points={points} />

      <OnboardingFooter>
        <OnboardingPrimaryButton disabled={pending} onClick={onStart}>
          {t("Start")}
        </OnboardingPrimaryButton>
        <OnboardingSecondaryButton disabled={pending} onClick={onScratch}>
          {t("I'd rather start from scratch")}
        </OnboardingSecondaryButton>
      </OnboardingFooter>
    </OnboardingColumn>
  );
}

/** A finished moment: its icon, what it means for the plan, and one way on. */
function PlacementOutcome({
  children,
  icon,
  onContinue,
  pending,
  success = false,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onContinue: () => void;
  pending: boolean;
  success?: boolean;
}) {
  const t = useExtracted();

  return (
    <OnboardingColumn>
      <StepIcon success={success}>{icon}</StepIcon>
      <OnboardingHeading>{children}</OnboardingHeading>
      <OnboardingFooter>
        <OnboardingPrimaryButton autoFocus disabled={pending} onClick={onContinue}>
          {t("See my plan")}
        </OnboardingPrimaryButton>
      </OnboardingFooter>
    </OnboardingColumn>
  );
}

export function PlacementDone({
  answered,
  forToday,
  onContinue,
  pending,
}: {
  answered: number;
  forToday: boolean;
  onContinue: () => void;
  pending: boolean;
}) {
  const t = useExtracted();

  return (
    <PlacementOutcome icon={<CircleCheckIcon />} onContinue={onContinue} pending={pending} success>
      <OnboardingTitle>
        {forToday ? t("That's enough questions for today") : t("Your starting point is set")}
      </OnboardingTitle>
      <OnboardingDescription>
        {forToday
          ? t(
              "Your plan starts from {count, plural, one {your first answer} other {your first # answers}}. Your first sessions ask a few more to fine-tune it.",
              { count: answered },
            )
          : t(
              "Based on {count, plural, one {# question} other {# questions}}. It gets more accurate every day.",
              { count: answered },
            )}
      </OnboardingDescription>
    </PlacementOutcome>
  );
}

/** No question could be written for this goal: the first sessions place the learner instead. */
export function PlacementUnavailable({
  onContinue,
  pending,
}: {
  onContinue: () => void;
  pending: boolean;
}) {
  const t = useExtracted();

  return (
    <PlacementOutcome icon={<SignpostIcon />} onContinue={onContinue} pending={pending}>
      <OnboardingTitle>{t("Let's skip the questions")}</OnboardingTitle>
      <OnboardingDescription>
        {t(
          "We couldn't prepare questions for this goal. Your first sessions will find your starting point instead.",
        )}
      </OnboardingDescription>
    </PlacementOutcome>
  );
}
