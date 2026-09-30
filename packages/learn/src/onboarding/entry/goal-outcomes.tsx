"use client";

import {
  GuitarIcon,
  HandHeartIcon,
  LightbulbIcon,
  MessageCircleQuestionIcon,
  MusicIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { LearnLink } from "../../learn-link";
import { type GoalError } from "../goal-errors";
import { type WaitlistOutcome } from "../onboarding-actions";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingFooter,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
  OnboardingTitle,
} from "../onboarding-frame";

const BUBBLE_CLASS =
  "bg-muted in-data-[mode=fun]:fun-glass self-end rounded-3xl rounded-br-lg px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap";

const ICON_CLASS =
  "bg-muted in-data-[mode=fun]:bg-fun-soft flex size-14 items-center justify-center rounded-2xl [&_svg]:size-7";

/**
 * Why the goal couldn't be created, said where the learner confirmed it. A guest who already has
 * their one goal gets the way to an account right there.
 */
export function GoalErrorAlert({
  error,
  signUpHref,
}: {
  error: GoalError | null;
  signUpHref: string;
}) {
  const t = useExtracted();

  if (!error) {
    return null;
  }

  return (
    <div className="flex flex-col items-start gap-2" role="alert">
      <p className="text-destructive text-sm">{error.message}</p>
      {error.needsAccount && (
        <LearnLink
          className="text-foreground text-sm font-medium underline underline-offset-4"
          href={signUpHref}
        >
          {t("Create a free account")}
        </LearnLink>
      )}
    </div>
  );
}

/** What the learner typed, as they typed it. */
export function TypedGoal({ goal }: { goal: string }) {
  return <p className={BUBBLE_CLASS}>{goal}</p>;
}

/**
 * A question gets a short explanation instead of a plan. Right after the learner sent it, it opens
 * by itself (`isStarting`); coming back to it later, it waits for their tap, since writing the
 * explanation is new work.
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
    <OnboardingColumn>
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

      <GoalErrorAlert error={error} signUpHref={signUpHref} />

      <OnboardingFooter>
        <OnboardingPrimaryButton disabled={isStarting} onClick={onStart}>
          {isStarting ? t("Opening your explanation…") : t("Explain it")}
        </OnboardingPrimaryButton>
      </OnboardingFooter>
    </OnboardingColumn>
  );
}

/** A goal the app can't help with, said kindly, with another way to start. */
export function DeclinedGoal({ goal, onRetry }: { goal: string; onRetry: () => void }) {
  const t = useExtracted();

  return (
    <OnboardingColumn>
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
      <OnboardingFooter>
        <OnboardingPrimaryButton onClick={onRetry}>{t("Try another goal")}</OnboardingPrimaryButton>
      </OnboardingFooter>
    </OnboardingColumn>
  );
}

/** Too vague to plan: ask for a little more instead of guessing. */
export function UnclearGoal({ goal, onRetry }: { goal: string; onRetry: () => void }) {
  const t = useExtracted();

  return (
    <OnboardingColumn>
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
      <OnboardingFooter>
        <OnboardingPrimaryButton onClick={onRetry}>
          {t("Write my goal again")}
        </OnboardingPrimaryButton>
      </OnboardingFooter>
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

  if (outcome === "joined") {
    return (
      <p className="text-success text-sm font-medium" role="status">
        {t("You're on the list. We'll let you know when lessons for playing are ready.")}
      </p>
    );
  }

  if (outcome === "signInRequired") {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {t("Create an account so we can let you know.")}{" "}
        <LearnLink
          className="text-foreground font-medium underline underline-offset-4"
          href={signUpHref}
        >
          {t("Create an account")}
        </LearnLink>
      </p>
    );
  }

  return outcome === "failed" ? (
    <p className="text-destructive text-sm" role="alert">
      {t("That didn't work. Try again in a moment.")}
    </p>
  ) : null;
}

/**
 * Playing an instrument needs someone to hear you play, so it's a waitlist for now. Meanwhile,
 * musicianship (reading music, ear training and rhythm) is a normal goal they can start today.
 */
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
    <OnboardingColumn>
      <TypedGoal goal={goal} />

      <span aria-hidden="true" className={ICON_CLASS}>
        <GuitarIcon />
      </span>

      <OnboardingHeading>
        <OnboardingTitle>
          {t("Lessons for playing {instrument} are coming", { instrument })}
        </OnboardingTitle>
        <OnboardingDescription>
          {t(
            "To teach you to play, we need to hear you play, and we're still building that. Join the waitlist, and start with musicianship today: reading music, ear training and rhythm.",
          )}
        </OnboardingDescription>
      </OnboardingHeading>

      <div className="bg-card ring-foreground/10 in-data-[mode=fun]:fun-glass flex items-start gap-3 rounded-3xl p-4 text-sm ring-1">
        <span className="flex h-lh shrink-0 items-center">
          <MusicIcon aria-hidden="true" className="size-5" />
        </span>
        <p>
          {t(
            "Musicianship for {instrument}: hear chords, read short melodies and keep the beat. No microphone needed.",
            { instrument },
          )}
        </p>
      </div>

      <WaitlistNote outcome={waitlist} signUpHref={signUpHref} />

      <GoalErrorAlert error={error} signUpHref={signUpHref} />

      <OnboardingFooter>
        <OnboardingPrimaryButton disabled={isStarting} onClick={onStartMusicianship}>
          {isStarting ? t("Saving your goal…") : t("Start musicianship")}
        </OnboardingPrimaryButton>
        <OnboardingSecondaryButton
          disabled={isJoining || waitlist === "joined"}
          onClick={onJoinWaitlist}
        >
          {t("Join the waitlist")}
        </OnboardingSecondaryButton>
      </OnboardingFooter>
    </OnboardingColumn>
  );
}
