"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import { buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, FlagIcon, HourglassIcon, MessageCircleIcon, MoonIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { PlusMark } from "../_components/plus-lock";
import { useBuddyName } from "../buddies/use-buddy-name";
import { LearnLink } from "../learn-link";
import { ExtraTimeButton } from "../session/extra-time-button";
import { TodayCardStatus, TodayStatusTile } from "./today-card-status";
import { useTodayScreen } from "./today-context";
import { useSessionState } from "./use-today-copy";

type DayEnd = "ahead" | "done" | "limit" | "rest";

/** What changed today, the day's one next step once it's done: Enter opens it. */
function SummaryLink() {
  const t = useExtracted();
  const { actions } = useTodayScreen();
  const ref = useEnterClick<HTMLAnchorElement>();

  return (
    <LearnLink
      className={cn(buttonVariants({ size: "lg" }), "h-12 w-full rounded-full text-base")}
      href={actions.summaryHref}
      prefetch={false}
      ref={ref}
    >
      {t("See what changed")}
      <ShortcutKbd tone="inverse">Enter</ShortcutKbd>
    </LearnLink>
  );
}

function useDayEnd(): DayEnd {
  const { ahead, done, limitReached, rest } = useSessionState();

  if (limitReached && !done) {
    return "limit";
  }

  if (ahead) {
    return "ahead";
  }

  return rest ? "rest" : "done";
}

/** The day's end in one bold line and a kind one under it. */
function useDayEndCopy(end: DayEnd): { detail: string | null; title: string } {
  const t = useExtracted();

  if (end === "limit") {
    return { detail: t("See you tomorrow!"), title: t("That's today's study time") };
  }

  if (end === "rest") {
    return { detail: t("Enjoy your day off!"), title: t("No study planned today") };
  }

  if (end === "ahead") {
    return {
      detail: t("You've done every lesson in your plan, or already know it."),
      title: t("Nothing new for today"),
    };
  }

  return { detail: null, title: t("Today's session is complete") };
}

/**
 * The buddy cheers a finished day and rests with the learner otherwise; before a buddy is picked,
 * a check, a moon or an hourglass says the same.
 */
function DayEndArt({ end }: { end: DayEnd }) {
  const { buddy, today } = useTodayScreen();

  if (buddy) {
    return (
      <Buddy
        beltColor={buddy.beltColor}
        className="motion-safe:animate-badge-land size-28"
        energy={buddy.energy}
        expression={end === "done" || end === "ahead" ? "cheer" : "kind"}
        glasses={buddy.glasses}
        kind={buddy.kind}
        studiedToday={today.studiedToday}
      />
    );
  }

  if (end === "done" || end === "ahead") {
    return (
      <TodayStatusTile className="bg-success/10 text-success motion-safe:animate-badge-land">
        <CheckIcon strokeWidth={2.5} />
      </TodayStatusTile>
    );
  }

  return (
    <TodayStatusTile className="bg-muted text-muted-foreground">
      {end === "rest" ? <MoonIcon /> : <HourglassIcon />}
    </TodayStatusTile>
  );
}

const LINK_CLASS = "h-12 w-full rounded-full text-base";

/**
 * The week's challenge or mock exam ahead: its intro shows what it asks, before its day too. A mock
 * the learner's plan doesn't include is marked Plus; its intro says what Plus unlocks.
 */
function ChallengeLink({ primary }: { primary: boolean }) {
  const t = useExtracted();
  const format = useFormatter();
  const { actions, today } = useTodayScreen();
  const challenge = today.weeklyChallenge;

  if (!challenge?.date || challenge.date < today.session.localDate) {
    return null;
  }

  const day = format.dateTime(challenge.date, { timeZone: "UTC", weekday: "long" });

  return (
    <LearnLink
      className={cn(
        buttonVariants({ size: "lg", variant: primary ? "default" : "outline" }),
        LINK_CLASS,
      )}
      href={actions.challengeHref(challenge.planItemId)}
    >
      <FlagIcon aria-hidden="true" data-icon="inline-start" />
      {challenge.kind === "mock"
        ? t("See {day}'s mock exam", { day })
        : t("See {day}'s challenge", { day })}
      {challenge.access === "plusRequired" && (
        <PlusMark className={cn(primary && "bg-primary-foreground/20 text-primary-foreground")} />
      )}
    </LearnLink>
  );
}

/** The buddy quizzes the learner on anything in the plan, when the host has the buddy's tab. */
function BuddyPracticeLink() {
  const t = useExtracted();
  const { actions, buddy } = useTodayScreen();
  const name = useBuddyName({ kind: buddy?.kind ?? "noodle", name: buddy?.name ?? null });

  if (!actions.buddyHref) {
    return null;
  }

  return (
    <LearnLink
      className={cn(buttonVariants({ size: "lg", variant: "ghost" }), LINK_CLASS)}
      href={actions.buddyHref}
    >
      <MessageCircleIcon aria-hidden="true" data-icon="inline-start" />
      {buddy ? t("Practice with {name}", { name }) : t("Practice with your buddy")}
    </LearnLink>
  );
}

/**
 * A study day with nothing new: what's still useful, the best first. Practice while there are
 * questions to practice, the week's challenge or mock ahead, then the buddy, who quizzes on
 * anything in the plan.
 */
function AheadActions() {
  const t = useExtracted();
  const { actions, today } = useTodayScreen();
  const { extraTime } = today.session;

  return (
    <>
      {extraTime.available && (
        <ExtraTimeButton
          action={actions.addExtraTime}
          label={t("Practice for {minutes} minutes", { minutes: String(extraTime.minutes) })}
          minutes={extraTime.minutes}
          variant="default"
        />
      )}
      <ChallengeLink primary={!extraTime.available} />
      <BuddyPracticeLink />
    </>
  );
}

/**
 * The day's blocks are done (or a guardian's limit was reached, or it's a rest day): the buddy, one
 * line, what changed, and "Study 10 more minutes" while it's offered. Extra time is capped and
 * never passes the limit. A study day with nothing new says so and offers what's still useful.
 */
export function TodayDayDone() {
  const end = useDayEnd();
  const copy = useDayEndCopy(end);
  const { limitReached } = useSessionState();
  const { actions, today } = useTodayScreen();
  const { extraTime } = today.session;

  return (
    <TodayCardStatus art={<DayEndArt end={end} />} detail={copy.detail} title={copy.title}>
      {end === "done" && <SummaryLink />}
      {end === "ahead" && <AheadActions />}

      {end !== "ahead" && extraTime.available && !limitReached && (
        <ExtraTimeButton action={actions.addExtraTime} minutes={extraTime.minutes} />
      )}
    </TodayCardStatus>
  );
}
