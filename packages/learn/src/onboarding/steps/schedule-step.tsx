"use client";

import { type PlanTimeAdvice, getRecommendedTime } from "@zoonk/core/plans/time-advice-contract";
import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { Toggle } from "@zoonk/ui/components/toggle";
import { cn } from "@zoonk/ui/lib/utils";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useExtracted, useFormatter } from "next-intl";
import { useState } from "react";
import { WeekendTime } from "../../_components/weekend-time";
import { useFormatIsoDate } from "../../_utils/iso-date";
import { useFormatDuration } from "../../_utils/time-format";
import { usePoll } from "../../_utils/use-poll";
import { isWeekend } from "../../plan/week-shape";
import { type Choice, ChoiceList } from "../choice-list";
import { StepForm } from "./step-form";

/** From a short habit to a full study day for a big exam: the plan takes up to 4 hours. */
const MINUTE_OPTIONS = ["15", "30", "45", "60", "90", "120", "180", "240"].map(Number);
const DAYS_PER_WEEK = 7;
const EVERY_DAY = Array.from({ length: DAYS_PER_WEEK }, (_, day) => day);
/** A Sunday, so weekday names come out in order from Sunday (0). */
const FIRST_SUNDAY = Date.parse("2023-01-01T00:00:00Z");
const ADVICE_POLL_MS = 3000;
/** The plan is usually ready by now; past this the question goes on without a recommendation. */
const ADVICE_TIMEOUT_MS = 3 * 60 * 1000;

/**
 * The time chips: the usual amounts, with the recommended time in place of the closest one when
 * it isn't one of them, so the row keeps its size; the learner's own pick always stays.
 */
function getMinuteOptions({
  picked,
  recommended,
}: {
  picked: number | null;
  recommended: number | null;
}): number[] {
  if (recommended === null || MINUTE_OPTIONS.some((option) => option === recommended)) {
    return [...MINUTE_OPTIONS];
  }

  const closest = MINUTE_OPTIONS.reduce((best, option) =>
    Math.abs(option - recommended) < Math.abs(best - recommended) ? option : best,
  );

  const options =
    closest === picked
      ? [...MINUTE_OPTIONS, recommended]
      : MINUTE_OPTIONS.map((option) => (option === closest ? recommended : option));

  return options.toSorted((a, b) => a - b);
}

function useMinuteChoices({
  picked,
  recommended,
}: {
  picked: string | null;
  recommended: number | null;
}): Choice<string>[] {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const options = getMinuteOptions({ picked: picked ? Number(picked) : null, recommended });

  return options.map((value) => ({
    description: value === recommended ? t("Recommended") : undefined,
    label: formatDuration(value),
    value: String(value),
  }));
}

/** The option closest to the goal's first pick, so a pick between two options still lands. */
function getFirstPick(minutes: number): string {
  return String(
    MINUTE_OPTIONS.reduce((best, option) =>
      Math.abs(option - minutes) < Math.abs(best - minutes) ? option : best,
    ),
  );
}

/**
 * The time to recommend: the time that studies the whole goal in depth by its date, or, when no
 * daily time does, the most time a day.
 */
function getRecommended(advice: PlanTimeAdvice | null): number | null {
  return advice ? (getRecommendedTime(advice)?.dailyMinutes ?? null) : null;
}

/**
 * The goal's daily time from its plan, on the chosen study days, asked again whenever they
 * change. The plan may still be being built when the question shows, so it asks until it's ready
 * (and gives up quietly after a few minutes: the question works without it).
 */
function useTimeAdvice({
  dated,
  getAdvice,
  studyDays,
}: {
  /** Whether the goal has a date to cover it by: without one, there's nothing to recommend. */
  dated: boolean;
  getAdvice: (studyDays: number[]) => Promise<PlanTimeAdvice | null>;
  studyDays: number[];
}): { advice: PlanTimeAdvice | null; waiting: boolean } {
  const key = studyDays.join(",");
  const [answer, setAnswer] = useState<{ advice: PlanTimeAdvice; key: string } | null>(null);
  const current = answer?.key === key && answer.advice.ready;

  const poll = usePoll({
    active: dated && !current,
    intervalMs: ADVICE_POLL_MS,
    onPoll: async () => {
      const advice = await getAdvice(studyDays);

      if (!advice) {
        throw new Error("The goal's daily time couldn't be read");
      }

      setAnswer({ advice, key });
    },
    timeoutMs: ADVICE_TIMEOUT_MS,
  });

  // While other days are asked about, the last answer stays until the new one comes.
  return {
    advice: answer?.advice.ready ? answer.advice : null,
    waiting: poll.status === "polling",
  };
}

/**
 * What the question recommends, said once the plan says it: the time that covers everything in
 * depth by the goal's date, or, when that's more than anyone keeps up, that it is, with the most
 * time a day. While the plan is still being built, it says so.
 */
function AdviceSentence({ advice, waiting }: { advice: PlanTimeAdvice | null; waiting: boolean }) {
  const t = useExtracted();
  const format = useFormatter();
  const formatDuration = useFormatDuration();
  const formatDate = useFormatIsoDate();
  const date = advice?.targetDate ? formatDate(advice.targetDate) : null;

  if (waiting && !advice) {
    return t("Working out the time your goal needs…");
  }

  if (date && advice?.recommendedMinutes) {
    return t("To study everything in depth by {date}, we recommend {time} a day.", {
      date,
      time: formatDuration(advice.recommendedMinutes),
    });
  }

  if (date && advice?.maximum) {
    const values = {
      date,
      share: format.number(advice.maximum.coveredShare, { style: "percent" }),
      time: formatDuration(advice.maximum.dailyMinutes),
    };

    return advice.measure === "exam"
      ? t(
          "Studying everything in depth by {date} would take more than {time} a day. We recommend {time} a day: it covers {share} of the exam, what comes up most first.",
          values,
        )
      : t(
          "Studying everything in depth by {date} would take more than {time} a day. We recommend {time} a day: it covers {share} of your goal, what matters most first.",
          values,
        );
  }

  return t("You can change this anytime.");
}

function WeekdayToggles({
  days,
  onChange,
}: {
  days: number[];
  onChange: (days: number[]) => void;
}) {
  const t = useExtracted();
  const format = useFormatter();

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-base font-semibold">{t("Which days?")}</legend>
      <div className="flex justify-between gap-1.5">
        {EVERY_DAY.map((day) => {
          const date = new Date(FIRST_SUNDAY + day * MS_PER_DAY);
          const pressed = days.includes(day);

          return (
            <Toggle
              aria-label={format.dateTime(date, { timeZone: "UTC", weekday: "long" })}
              className={cn(
                "size-11 rounded-full text-sm font-semibold",
                "aria-pressed:bg-foreground aria-pressed:text-background",
              )}
              key={day}
              onPressedChange={(next) =>
                onChange(
                  next
                    ? [...days, day].toSorted((a, b) => a - b)
                    : days.filter((item) => item !== day),
                )
              }
              pressed={pressed}
              variant="outline"
            >
              {format.dateTime(date, { timeZone: "UTC", weekday: "narrow" })}
            </Toggle>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Saturday and Sunday's own time, in the same chips as the rest of the week. */
function WeekendMinutes({
  choices,
  minutes,
  onChange,
  weekdayMinutes,
}: {
  choices: Choice<string>[];
  minutes: string | null;
  onChange: (minutes: string | null) => void;
  /** Where the weekend's own time starts when it's switched on. */
  weekdayMinutes: string;
}) {
  const t = useExtracted();

  return (
    <WeekendTime
      checked={minutes !== null}
      className="text-base font-semibold"
      onCheckedChange={(checked) => onChange(checked ? weekdayMinutes : null)}
    >
      {minutes !== null && (
        <ChoiceList
          choices={choices}
          label={t("Minutes on weekends")}
          numberKeys={false}
          onChange={onChange}
          value={minutes}
          variant="chips"
        />
      )}
    </WeekendTime>
  );
}

/**
 * How much time a day and on which days. It comes after placement, once the plan knows what the
 * learner already knows, so it recommends the time the plan needs to study the whole goal in depth
 * by its date, on the days they pick: the same number the plan shows next. That time comes picked
 * until the learner picks one; less is theirs to choose, and the plan then says what it covers.
 * Without a date there's nothing to cover by, so a starting pick from the goal's size comes picked
 * instead, claiming nothing. Weekends can take their own time.
 */
export function ScheduleStep({
  dated,
  getTimeAdvice,
  onAnswer,
  pending,
  recommendedMinutes,
}: {
  /** The goal has a date (its own, or its exam's): the plan says the time that covers it. */
  dated: boolean;
  /** The goal's daily time from its plan, on these study days; null when it couldn't be read. */
  getTimeAdvice: (studyDays: number[]) => Promise<PlanTimeAdvice | null>;
  onAnswer: (input: OnboardingAnswerInput) => void;
  pending: boolean;
  /** A starting pick from how big the goal is and how soon its date is, until the plan says. */
  recommendedMinutes: number;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const [picked, setPicked] = useState<string | null>(null);
  const [weekendMinutes, setWeekendMinutes] = useState<string | null>(null);
  const [days, setDays] = useState<number[]>(EVERY_DAY);
  const { advice, waiting } = useTimeAdvice({ dated, getAdvice: getTimeAdvice, studyDays: days });
  const recommended = getRecommended(advice);
  const choices = useMinuteChoices({ picked, recommended });
  const minutes = picked ?? String(recommended ?? getFirstPick(recommendedMinutes));
  const studiesOnWeekends = days.some((day) => isWeekend(day));
  const weekend = studiesOnWeekends ? weekendMinutes : null;

  const weekly = days.reduce(
    (total, day) => total + Number(isWeekend(day) && weekend ? weekend : minutes),
    0,
  );

  return (
    <StepForm
      canContinue={days.length > 0}
      description={
        <span aria-live="polite">
          <AdviceSentence advice={advice} waiting={waiting} />
        </span>
      }
      onContinue={() =>
        onAnswer({
          dailyMinutes: Number(minutes),
          question: "schedule",
          studyDays: days.length === EVERY_DAY.length ? undefined : days,
          timeZone: getLocalTimeZone(),
          weekendMinutes: weekend ? Number(weekend) : undefined,
        })
      }
      pending={pending}
      title={t("How much time can you study each day?")}
    >
      <ChoiceList
        choices={choices}
        label={t("Minutes a day")}
        onChange={setPicked}
        value={minutes}
        variant="chips"
      />

      <WeekdayToggles days={days} onChange={setDays} />

      {studiesOnWeekends && (
        <WeekendMinutes
          choices={choices}
          minutes={weekendMinutes}
          onChange={setWeekendMinutes}
          weekdayMinutes={minutes}
        />
      )}

      <p aria-live="polite" className="text-muted-foreground text-sm">
        {t("{days, plural, one {# day} other {# days}} · {time} a week", {
          days: days.length,
          time: formatDuration(weekly),
        })}
      </p>
    </StepForm>
  );
}
