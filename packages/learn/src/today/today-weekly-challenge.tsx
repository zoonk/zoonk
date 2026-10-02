"use client";

import { Badge } from "@zoonk/ui/components/badge";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { TimerIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { useExperienceMode } from "../mode-provider";
import { useTodayScreen } from "./today-context";

const DAYS_IN_A_WEEK = 7;

/** "Sunday" within the week; a date further away, with its year when it's in another year. */
function useChallengeDay() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const { today } = useTodayScreen();

  return (date: Date | null): string => {
    if (!date) {
      return t("This week");
    }

    const daysAway = (date.getTime() - today.session.localDate.getTime()) / MS_PER_DAY;
    const isoDate = date.toISOString().slice(0, 10);

    return daysAway >= 0 && daysAway < DAYS_IN_A_WEEK
      ? formatDate(isoDate, "weekday")
      : formatDate(isoDate, "day");
  };
}

/**
 * The week's checkpoint under the week row: "Sunday: mock exam · 2h 30m, timed". In Fun it's the
 * Big Challenge. A mock the free plan doesn't include says Plus instead of disappearing.
 */
export function TodayWeeklyChallenge() {
  const t = useExtracted();
  const mode = useExperienceMode();
  const duration = useFormatDuration();
  const challengeDay = useChallengeDay();
  const { today } = useTodayScreen();
  const challenge = today.weeklyChallenge;

  if (!challenge) {
    return null;
  }

  const weeklyName = mode === "fun" ? t("Big Challenge") : t("weekly challenge");
  const name = challenge.kind === "mock" ? t("mock exam") : weeklyName;

  const detail = challenge.timeLimitMinutes
    ? t("{duration}, timed", { duration: duration(challenge.timeLimitMinutes) })
    : t("{count, plural, one {# question} other {# questions}}", { count: challenge.questions });

  return (
    <div className="bg-muted/60 in-data-[mode=fun]:fun-glass flex items-start gap-3 rounded-2xl px-4 py-3">
      <span className="bg-warning/15 text-warning flex size-9 shrink-0 items-center justify-center rounded-xl">
        <TimerIcon aria-hidden="true" className="size-4.5" />
      </span>

      <p className="min-w-0 flex-1 text-sm">
        <span className="font-medium">
          {t("{day}: {name}", { day: challengeDay(challenge.date), name })}
        </span>
        <span className="text-muted-foreground block">{detail}</span>
      </p>

      {challenge.access === "plusRequired" && <Badge variant="secondary">{t("Plus")}</Badge>}
    </div>
  );
}
