"use client";

import { type TodayView } from "@zoonk/core/view-models/today/get";
import { useExtracted, useFormatter } from "next-intl";
import { KindDot } from "../_components/kind-tile";
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

/** The week's event as its dot shows it, wherever it's offered: a mock exam or the challenge. */
export function getChallengeEventKind(challenge: Pick<Challenge, "kind">): "challenge" | "mock" {
  return challenge.kind === "mock" ? "mock" : "challenge";
}

export function getChallengeKind(challenge: Challenge): "challenge" | "mock" | "review" {
  return isFullReview(challenge) ? "review" : getChallengeEventKind(challenge);
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
 * A row under the days: the kind's dot, its name and, quieter under it, when and how much
 * ("Sunday · 90 questions"). Under the name, as every row has it: after it, on one line, the
 * aside's column cut "Weekly challenge · Sunday · 10 q…" in both languages.
 */
function ChallengeLine({ facts, name }: { facts: string; name: string }) {
  return (
    <ListRowContent>
      <ListRowTitle>{name}</ListRowTitle>
      <ListRowDescription>{facts}</ListRowDescription>
    </ListRowContent>
  );
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
      <ListRowLeading className="w-3 justify-center">
        <KindDot kind="review" />
      </ListRowLeading>
      <ChallengeLine
        facts={[weekdayLabel(date), t("every topic, your weakest first")].join(" · ")}
        name={t("Full review")}
      />
    </ListRow>
  );
}

/**
 * The week's challenge under the days: its name over its day, questions and time; the row opens
 * its intro. One the plan adds only once the day is opened (no saved row yet) says the same, with
 * nothing to open until then. A free plan's mock day is its full review.
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
    challenge.questions !== null &&
      challenge.questions > 0 &&
      t("{count, plural, one {# question} other {# questions}}", { count: challenge.questions }),
    challenge.timeLimitMinutes !== null && formatDuration(challenge.timeLimitMinutes),
  ].filter(Boolean);

  const content = (
    <>
      <ListRowLeading className="w-3 justify-center">
        <KindDot kind={getChallengeEventKind(challenge)} />
      </ListRowLeading>
      <ChallengeLine facts={facts.join(" · ")} name={name} />
    </>
  );

  if (challenge.planItemId === null) {
    return <ListRow className="border-t">{content}</ListRow>;
  }

  return (
    <ListRowLink className="border-t" href={actions.challengeHref(challenge.planItemId)}>
      {content}
    </ListRowLink>
  );
}
