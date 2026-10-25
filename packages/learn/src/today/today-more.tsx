"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { MessageCircleIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { KindDot } from "../_components/kind-tile";
import {
  ListGroup,
  ListRowContent,
  ListRowIcon,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
} from "../_components/list-group";
import { PlusMark } from "../_components/plus-lock";
import { useBuddyName } from "../buddies/use-buddy-name";
import { CatchUpLater } from "./today-catch-up";
import { useTodayScreen } from "./today-context";
import { TodayExtraTime } from "./today-extra-time";
import { getChallengeEventKind, useWeekdayLabel } from "./today-week-challenge";
import { useDayState, useTodayPastDate, useUpNextLessons } from "./use-today-copy";

/** A secondary action under the day: 44px across a phone, small beside the day from `sm`. */
const SECONDARY_CLASS = "max-sm:h-11 max-sm:w-full max-sm:rounded-lg max-sm:text-sm sm:self-start";

/**
 * "Study 10 more minutes" of practice once the day is done and every lesson of the plan is, "Study
 * for 10 minutes" on such a rest day with no study yet; never past the daily limit, and capped by
 * core.
 */
function MoreTime() {
  const t = useExtracted();
  const { actions, today } = useTodayScreen();
  const { extraTime } = today.session;

  if (!extraTime.available) {
    return null;
  }

  return (
    <TodayExtraTime
      action={actions.addExtraTime}
      className={SECONDARY_CLASS}
      label={
        today.studiedToday
          ? undefined
          : t("Study for {minutes} minutes", { minutes: String(extraTime.minutes) })
      }
      minutes={extraTime.minutes}
    />
  );
}

/**
 * The week's challenge or mock exam ahead, on a day with nothing new: its intro shows what it asks,
 * before its day too. A mock the learner's plan doesn't include is marked Plus. One the plan adds
 * only once the day is opened (no saved row yet) has no intro to show: the week's row says when.
 */
function ChallengeRow() {
  const t = useExtracted();
  const weekdayLabel = useWeekdayLabel();
  const { actions, today } = useTodayScreen();
  const challenge = today.weeklyChallenge;

  if (!challenge?.date || !challenge.planItemId || challenge.date < today.session.localDate) {
    return null;
  }

  return (
    <ListRowLink href={actions.challengeHref(challenge.planItemId)}>
      <ListRowLeading className="w-4 justify-center">
        <KindDot kind={getChallengeEventKind(challenge)} />
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle className="flex items-center gap-2">
          {challenge.kind === "mock"
            ? t("See {day}'s mock exam", { day: weekdayLabel(challenge.date) })
            : t("See {day}'s challenge", { day: weekdayLabel(challenge.date) })}
          {challenge.access === "plusRequired" && <PlusMark />}
        </ListRowTitle>
      </ListRowContent>
    </ListRowLink>
  );
}

/** The buddy quizzes the learner on anything in the plan, when the host has the buddy's tab. */
function BuddyPracticeRow() {
  const t = useExtracted();
  const { actions, buddy } = useTodayScreen();
  const name = useBuddyName(buddy);

  if (!actions.buddyHref) {
    return null;
  }

  return (
    <ListRowLink href={actions.buddyHref}>
      <ListRowLeading>
        <ListRowIcon>
          <MessageCircleIcon />
        </ListRowIcon>
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{t("Practice with {name}", { name })}</ListRowTitle>
      </ListRowContent>
    </ListRowLink>
  );
}

/**
 * What else the day offers, under it: practice once it's done or on a rest day when every lesson
 * is done, the lessons left to catch up while the day is underway, and on a day with nothing new
 * the week's challenge and the buddy's quiz as rows under its main action. Nothing once the goal's
 * date came with lessons left, nor beside "Keep learning", which already goes on with the plan's
 * next lessons, those left to catch up first.
 */
export function TodayMore({ className }: { className?: string }) {
  const state = useDayState();
  const pastDate = useTodayPastDate();
  const keepLearning = useUpNextLessons().length > 0;

  // Past the goal's date, the one way on is the Plan's (see `TodayAction`).
  if (pastDate || keepLearning) {
    return null;
  }

  if (state === "ahead") {
    return (
      <ListGroup className={cn("empty:hidden", className)} data-slot="today-more">
        <ChallengeRow />
        <BuddyPracticeRow />
      </ListGroup>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3 empty:hidden", className)} data-slot="today-more">
      {(state === "done" || state === "rest") && <MoreTime />}
      {(state === "underway" || state === "done") && <CatchUpLater />}
    </div>
  );
}
