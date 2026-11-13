"use client";

import { PendingLink } from "@zoonk/ui/patterns/links/pending";
import {
  BellIcon,
  GuitarIcon,
  HandHeartIcon,
  LightbulbIcon,
  MessageCircleQuestionIcon,
  PlayIcon,
  UserPlusIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../../_components/save-error";
import { useSentenceSpace } from "../../_utils/locale";
import { type GoalError } from "../goal-errors";
import { type WaitlistOutcome } from "../onboarding-actions";
import {
  ONBOARDING_ACTION_LINK_CLASS,
  OnboardingActions,
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
  OnboardingTitle,
} from "../onboarding-frame";
import { GoalLimitNotice, isPlusGoalLimit } from "./goal-limit-notice";

const BUBBLE_CLASS =
  "bg-muted self-end rounded-xl rounded-br-sm px-3.5 py-2.5 text-reading leading-relaxed text-pretty whitespace-pre-wrap";

const ICON_CLASS = "text-muted-foreground flex [&_svg]:size-6";

export function SignUpLink({ href }: { href: string }) {
  const t = useExtracted();

  return (
    <PendingLink
      className={ONBOARDING_ACTION_LINK_CLASS.main}
      href={href}
      icon={<UserPlusIcon aria-hidden="true" />}
    >
      {t("Create a free account")}
    </PendingLink>
  );
}

/** What starting a goal couldn't do. The way on (an account to create) is `GoalActions`' or the alert's. */
export function GoalErrorMessage({ error }: { error: GoalError | null }) {
  if (!error) {
    return null;
  }

  if (error.limit && isPlusGoalLimit(error.limit)) {
    return (
      <div role="alert">
        <GoalLimitNotice reason={error.limit} />
      </div>
    );
  }

  return error.needsAccount ? (
    <p className="text-base text-pretty" role="alert">
      {error.message}
    </p>
  ) : (
    <ChangeSaveError>{error.message}</ChangeSaveError>
  );
}

/** For a screen with no bar: the message with its way on under it. */
export function GoalErrorAlert({
  error,
  signUpHref,
}: {
  error: GoalError | null;
  signUpHref: string;
}) {
  return (
    <div className="flex flex-col gap-4 empty:hidden">
      <GoalErrorMessage error={error} />
      {error?.needsAccount && <SignUpLink href={signUpHref} />}
    </div>
  );
}

/** A goal screen's bar: creating an account takes its actions' place when the goal needs one. */
export function GoalActions({
  children,
  error,
  signUpHref,
}: {
  children: React.ReactNode;
  error: GoalError | null;
  signUpHref: string;
}) {
  return (
    <OnboardingActions>
      {error?.needsAccount ? <SignUpLink href={signUpHref} /> : children}
    </OnboardingActions>
  );
}

export function TypedGoal({ goal }: { goal: string }) {
  return <p className={BUBBLE_CLASS}>{goal}</p>;
}

/**
 * Right after sending it opens by itself (`isStarting`); coming back later it waits for a tap,
 * since writing it is new work.
 */
export function ExplainGoal({
  error,
  goal,
  isStarting,
  onStart,
  question,
  signUpHref,
}: {
  error: GoalError | null;
  goal: string;
  isStarting: boolean;
  onStart: () => void;
  question: string;
  signUpHref: string;
}) {
  const t = useExtracted();

  return (
    <OnboardingColumn
      bar={
        <GoalActions error={error} signUpHref={signUpHref}>
          <OnboardingPrimaryButton
            busy={isStarting}
            icon={<LightbulbIcon aria-hidden="true" />}
            onClick={onStart}
          >
            {t("Explain it")}
          </OnboardingPrimaryButton>
        </GoalActions>
      }
    >
      <TypedGoal goal={goal} />
      <span aria-hidden="true" className={ICON_CLASS}>
        <LightbulbIcon />
      </span>
      <OnboardingHeading>
        <OnboardingTitle>{question}</OnboardingTitle>
        <OnboardingDescription>
          {t("A short explanation written for you, about 5 minutes.")}
        </OnboardingDescription>
      </OnboardingHeading>

      <GoalErrorMessage error={error} />
    </OnboardingColumn>
  );
}

export function DeclinedGoal({ goal, onRetry }: { goal: string; onRetry: () => void }) {
  const t = useExtracted();

  return (
    <OnboardingColumn
      bar={
        <OnboardingActions>
          <OnboardingPrimaryButton onClick={onRetry}>
            {t("Try another goal")}
          </OnboardingPrimaryButton>
        </OnboardingActions>
      }
    >
      <TypedGoal goal={goal} />
      <span aria-hidden="true" className={ICON_CLASS}>
        <HandHeartIcon />
      </span>
      <OnboardingHeading>
        <OnboardingTitle>{t("We can't help with this goal")}</OnboardingTitle>
        <OnboardingDescription>
          {t(
            "Zoonk doesn't teach anything that could hurt you or others, gambling or ways to cheat. Is there something else you'd like to learn?",
          )}
        </OnboardingDescription>
      </OnboardingHeading>
    </OnboardingColumn>
  );
}

export function UnclearGoal({ goal, onRetry }: { goal: string; onRetry: () => void }) {
  const t = useExtracted();

  return (
    <OnboardingColumn
      bar={
        <OnboardingActions>
          <OnboardingPrimaryButton onClick={onRetry}>
            {t("Write my goal again")}
          </OnboardingPrimaryButton>
        </OnboardingActions>
      }
    >
      <TypedGoal goal={goal} />
      <span aria-hidden="true" className={ICON_CLASS}>
        <MessageCircleQuestionIcon />
      </span>
      <OnboardingHeading>
        <OnboardingTitle>{t("Tell us a bit more")}</OnboardingTitle>
        <OnboardingDescription>
          {t(
            "What do you want to learn or be able to do? For example: “pass the driving test”, “understand statistics for work” or “speak French on my trip”.",
          )}
        </OnboardingDescription>
      </OnboardingHeading>
    </OnboardingColumn>
  );
}

function WaitlistNote({
  outcome,
  signUpHref,
}: {
  outcome: WaitlistOutcome | null;
  signUpHref: string;
}) {
  const t = useExtracted();
  const space = useSentenceSpace();

  if (outcome === "joined") {
    return (
      <p className="text-success-text text-sm font-medium" role="status">
        {t("You're on the list. We'll let you know when lessons for playing are ready.")}
      </p>
    );
  }

  if (outcome === "signInRequired") {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {t("Create an account so we can let you know.")}
        {space}
        <PendingLink
          className="text-foreground font-medium underline underline-offset-4"
          href={signUpHref}
        >
          {t("Create an account")}
        </PendingLink>
      </p>
    );
  }

  return outcome === "failed" ? <ChangeSaveError /> : null;
}

export function InstrumentGoal({
  error,
  goal,
  instrument,
  isJoining,
  isStarting,
  onJoinWaitlist,
  onStartMusicianship,
  signUpHref,
  waitlist,
}: {
  error: GoalError | null;
  goal: string;
  instrument: string;
  isJoining: boolean;
  isStarting: boolean;
  onJoinWaitlist: () => void;
  onStartMusicianship: () => void;
  signUpHref: string;
  waitlist: WaitlistOutcome | null;
}) {
  const t = useExtracted();

  return (
    <OnboardingColumn
      bar={
        <GoalActions error={error} signUpHref={signUpHref}>
          <OnboardingSecondaryButton
            busy={isJoining}
            // Both labels are long: on a phone each takes a line, so neither wraps.
            className="max-lg:basis-full"
            disabled={waitlist === "joined"}
            icon={<BellIcon aria-hidden="true" />}
            onClick={onJoinWaitlist}
          >
            {t("Join the waitlist")}
          </OnboardingSecondaryButton>
          <OnboardingPrimaryButton
            busy={isStarting}
            icon={<PlayIcon aria-hidden="true" />}
            onClick={onStartMusicianship}
          >
            {t("Start music basics")}
          </OnboardingPrimaryButton>
        </GoalActions>
      }
    >
      <TypedGoal goal={goal} />

      <span aria-hidden="true" className={ICON_CLASS}>
        <GuitarIcon />
      </span>

      <OnboardingHeading>
        <OnboardingTitle>
          {t({
            description:
              '{instrument} names what the learner wants to play, or singing, like "guitar".',
            message: "We can't teach {instrument} yet",
            values: { instrument },
          })}
        </OnboardingTitle>
        <OnboardingDescription>
          {t(
            "You can start with the basics of music today: reading notes, rhythm and training your ear.",
          )}
        </OnboardingDescription>
      </OnboardingHeading>

      <WaitlistNote outcome={waitlist} signUpHref={signUpHref} />
      <GoalErrorMessage error={error} />
    </OnboardingColumn>
  );
}
