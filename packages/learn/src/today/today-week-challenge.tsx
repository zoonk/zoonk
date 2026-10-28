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

/** A mock the learner's plan doesn't include leaves its day to a full review of every topic. */
function isFullReview(challenge: Challenge): boolean {
  return challenge.kind === "mock" && challenge.access === "plusRequired";
}

export function getChallengeEventKind(challenge: Pick<Challenge, "kind">): "challenge" | "mock" {
  return challenge.kind === "mock" ? "mock" : "challenge";
}

export function getChallengeKind(challenge: Challenge): "challenge" | "mock" | "review" {
  return isFullReview(challenge) ? "review" : getChallengeEventKind(challenge);
}

export function useChallengeDayName() {
  const t = useExtracted();

  return (challenge: Challenge): string => {
    if (isFullReview(challenge)) {
      return t("full review");
    }

    return challenge.kind === "mock" ? t("mock exam") : t("weekly challenge");
  };
}

export function useWeekdayLabel() {
  const format = useFormatter();
  return (date: Date) => toLabelCase(format.dateTime(date, { timeZone: "UTC", weekday: "long" }));
}

function ChallengeLine({ facts, name }: { facts: string; name: string }) {
  return (
    <ListRowContent>
      <ListRowTitle>{name}</ListRowTitle>
      <ListRowDescription>{facts}</ListRowDescription>
    </ListRowContent>
  );
}

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
