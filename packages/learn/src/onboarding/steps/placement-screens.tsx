"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { KindDot } from "../../_components/kind-tile";
import {
  ListGroup,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../../_components/list-group";
import { PlusMark } from "../../_components/plus-lock";
import { SuccessEyebrow } from "../../_components/success-eyebrow";
import { useFormatDuration } from "../../_utils/time-format";
import { LearnLink } from "../../learn-link";
import { type PlacementMockOutcome } from "../onboarding-actions";
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

type PlacementMockOffer = NonNullable<PlacementMockOutcome["offer"]> & { href: string };

/** How long the mock can take, from its quick check to its longest, the same on every plan. */
function useMockOfferText() {
  const t = useExtracted();
  const duration = useFormatDuration();

  return ({ minutes }: PlacementMockOffer): string => {
    const longest = duration(minutes.longest);
    const shortest = duration(minutes.shortest);

    if (minutes.longest === minutes.shortest) {
      return t("In the exam's format, about {time}.", { time: longest });
    }

    return t("In the exam's format, from {shortest} to {longest}. You pick how long.", {
      longest,
      shortest,
    });
  };
}

/**
 * A diagnostic mock in the exam's format, beside the quick questions: how long it can take, from
 * its quick check to its longest. It comes with Plus, so without it the row is marked Plus and
 * opens the lengths with what Plus unlocks. The quick questions stay the default.
 */
function PlacementMockRow({ mock }: { mock: PlacementMockOffer }) {
  const t = useExtracted();
  const offerText = useMockOfferText();

  return (
    <ListGroup>
      <ListRowLink href={mock.href}>
        <ListRowLeading>
          <KindDot kind="mock" />
        </ListRowLeading>
        <ListRowContent>
          <ListRowTitle>{t("Or take a mock exam")}</ListRowTitle>
          <ListRowDescription>{offerText(mock)}</ListRowDescription>
        </ListRowContent>
        {mock.access === "plusRequired" && (
          <ListRowTrailing>
            <PlusMark />
          </ListRowTrailing>
        )}
      </ListRowLink>
    </ListGroup>
  );
}

/**
 * Placement's start: what it's for in one sentence (with how many areas it covers
 * for an exam), Start, and starting from zero as the quiet way around it. An exam also offers a
 * diagnostic mock instead, with how long it takes.
 */
export function PlacementIntro({
  areaCount,
  mock,
  onScratch,
  onStart,
  pending,
  subject,
}: {
  /** How many areas an exam's placement asks about; 0 for other goals. */
  areaCount: number;
  /** A diagnostic mock instead, when the exam has one. */
  mock: PlacementMockOffer | null;
  onScratch: () => void;
  onStart: () => void;
  pending: boolean;
  subject: string;
}) {
  const t = useExtracted();

  return (
    <OnboardingColumn>
      <OnboardingHeading>
        <OnboardingSubject>{subject}</OnboardingSubject>
        <OnboardingTitle>{t("Let's see what you already know")}</OnboardingTitle>
        <OnboardingDescription>
          {areaCount > 0
            ? t(
                "A few quick questions about the {count, plural, one {# area} other {# areas}}, so your plan skips what you already know.",
                { count: areaCount },
              )
            : t("A few quick questions, so your plan skips what you already know.")}
        </OnboardingDescription>
      </OnboardingHeading>

      {mock && <PlacementMockRow mock={mock} />}

      <OnboardingFooter>
        <OnboardingPrimaryButton disabled={pending} onClick={onStart}>
          {t("Start")}
        </OnboardingPrimaryButton>
        <OnboardingSecondaryButton disabled={pending} onClick={onScratch} variant="ghost">
          {t("Start from zero")}
        </OnboardingSecondaryButton>
      </OnboardingFooter>
    </OnboardingColumn>
  );
}

/**
 * A finished moment: what was done (`done`, as the green ✓ line every finished screen opens with;
 * none when nothing was), what it means for the plan, and one way on.
 */
function PlacementOutcome({
  children,
  done,
  onContinue,
  pending,
}: {
  children: React.ReactNode;
  done?: string;
  onContinue: () => void;
  pending: boolean;
}) {
  const t = useExtracted();

  return (
    <OnboardingColumn>
      <OnboardingHeading>
        {done && <SuccessEyebrow>{done}</SuccessEyebrow>}
        {children}
      </OnboardingHeading>
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
  fromMock,
  onContinue,
  pending,
}: {
  answered: number;
  forToday: boolean;
  /** The whole exam was taken as a mock instead of the quick questions. */
  fromMock: boolean;
  onContinue: () => void;
  pending: boolean;
}) {
  const t = useExtracted();

  const done = fromMock
    ? t("Mock exam done")
    : t(
        "{count, plural, =0 {# questions answered} one {# question answered} other {# questions answered}}",
        { count: answered },
      );

  if (fromMock) {
    return (
      <PlacementOutcome done={done} onContinue={onContinue} pending={pending}>
        <OnboardingTitle>{t("Your mock exam set your starting point")}</OnboardingTitle>
        <OnboardingDescription>
          {t(
            "Based on {count, plural, one {your # answer} other {your # answers}}. It gets more accurate every day.",
            { count: answered },
          )}
        </OnboardingDescription>
      </PlacementOutcome>
    );
  }

  return (
    <PlacementOutcome done={done} onContinue={onContinue} pending={pending}>
      <OnboardingTitle>
        {forToday ? t("That's enough questions for today") : t("Your starting point is set")}
      </OnboardingTitle>
      <OnboardingDescription>
        {forToday
          ? t("Your first sessions ask a few more to fine-tune your plan.")
          : t("It gets more accurate every day.")}
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
    <PlacementOutcome onContinue={onContinue} pending={pending}>
      <OnboardingTitle>{t("Let's skip the questions")}</OnboardingTitle>
      <OnboardingDescription>
        {t(
          "We couldn't prepare questions for this goal. Your first sessions will find your starting point instead.",
        )}
      </OnboardingDescription>
    </PlacementOutcome>
  );
}

/**
 * The learner left the placement mock running: go on with it, or stop here, and the questions
 * answered set where the plan starts.
 */
export function PlacementMockRunning({
  href,
  onStop,
  pending,
}: {
  href: string;
  onStop: () => void;
  pending: boolean;
}) {
  const t = useExtracted();

  return (
    <OnboardingColumn>
      <OnboardingHeading>
        <OnboardingTitle>{t("Your mock exam is waiting")}</OnboardingTitle>
        <OnboardingDescription>
          {t(
            "Go on where you left it, or stop now: your plan starts from the questions you answered.",
          )}
        </OnboardingDescription>
      </OnboardingHeading>

      <OnboardingFooter>
        <LearnLink className={cn(buttonVariants({ size: "lg" }), "w-full")} href={href}>
          {t("Continue the mock exam")}
        </LearnLink>
        <OnboardingSecondaryButton disabled={pending} onClick={onStop} variant="ghost">
          {t("Stop and see my plan")}
        </OnboardingSecondaryButton>
      </OnboardingFooter>
    </OnboardingColumn>
  );
}
