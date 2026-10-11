"use client";

import { type TodayView } from "@zoonk/core/view-models/today/get";
import { useExtracted, useFormatter } from "next-intl";
import { KindTile } from "../_components/kind-tile";
import {
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
} from "../_components/list-group";
import { toLabelCase } from "../_utils/label-case";
import { useFormatDuration } from "../_utils/time-format";
import { useTodayScreen } from "./today-context";

export type Challenge = NonNullable<TodayView["weeklyChallenge"]>;

export function isSameDay(a: Date, b: Date | null): boolean {
  return b !== null && a.getTime() === b.getTime();
}

/**
 * A mock the learner's plan doesn't include (it comes with Plus) leaves its day to a full review of
 * every topic, so the week names that day for what it is; the mock stays in sight, marked Plus,
 * where mocks are offered.
 */
function isFullReview(challenge: Challenge): boolean {
  return challenge.kind === "mock" && challenge.access === "plusRequired";
}

export function getChallengeKind(challenge: Challenge): "challenge" | "mock" | "review" {
  if (isFullReview(challenge)) {
    return "review";
  }

  return challenge.kind === "mock" ? "mock" : "challenge";
}

/** "mock exam", "weekly challenge" or "full review", as a day of the week is named. */
export function useChallengeDayName() {
  const t = useExtracted();

  return (challenge: Challenge): string => {
    if (isFullReview(challenge)) {
      return t("full review");
    }

    return challenge.kind === "mock" ? t("mock exam") : t("weekly challenge");
  };
}

/** "Thursday", as a label starts. */
export function useWeekdayLabel() {
  const format = useFormatter();
  return (date: Date) => toLabelCase(format.dateTime(date, { timeZone: "UTC", weekday: "long" }));
}

/**
 * A free plan's full review under the days: what the day is, when, and what it asks. It isn't a
 * page of its own: the day's session holds it.
 */
function FullReviewRow({ date }: { date: Date }) {
  const t = useExtracted();
  const weekdayLabel = useWeekdayLabel();

  return (
    <ListRow className="border-t">
      <ListRowLeading>
        <KindTile kind="review" size="sm" />
      </ListRowLeading>
      <ListRowContent className="min-h-13 py-2.5">
        <ListRowTitle>{t("Full review")}</ListRowTitle>
        <ListRowDescription>
          {[weekdayLabel(date), t("every topic, your weakest first")].join(" · ")}
        </ListRowDescription>
      </ListRowContent>
    </ListRow>
  );
}

/**
 * The week's challenge under the days: its name, then its day, questions and time; the row opens
 * its intro. A free plan's mock day is its full review.
 */
export function ChallengeRow({ challenge, date }: { challenge: Challenge; date: Date }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const weekdayLabel = useWeekdayLabel();
  const { actions } = useTodayScreen();

  if (isFullReview(challenge)) {
    return <FullReviewRow date={date} />;
  }

  const name = challenge.kind === "mock" ? t("Mock exam") : t("Weekly challenge");

  const facts = [
    weekdayLabel(date),
    challenge.questions > 0 &&
      t("{count, plural, one {# question} other {# questions}}", { count: challenge.questions }),
    challenge.timeLimitMinutes !== null && formatDuration(challenge.timeLimitMinutes),
  ].filter(Boolean);

  return (
    <ListRowLink className="border-t" href={actions.challengeHref(challenge.planItemId)}>
      <ListRowLeading>
        <KindTile kind={challenge.kind === "mock" ? "mock" : "challenge"} size="sm" />
      </ListRowLeading>
      <ListRowContent className="min-h-13 py-2.5">
        <ListRowTitle>{name}</ListRowTitle>
        <ListRowDescription>{facts.join(" · ")}</ListRowDescription>
      </ListRowContent>
    </ListRowLink>
  );
}
