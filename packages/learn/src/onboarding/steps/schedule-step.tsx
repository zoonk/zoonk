"use client";

import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { Toggle } from "@zoonk/ui/components/toggle";
import { cn } from "@zoonk/ui/lib/utils";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useExtracted, useFormatter } from "next-intl";
import { useState } from "react";
import { useFormatDuration, useFormatTimeOfDay } from "../../_utils/time-format";
import { type Choice, ChoiceList } from "../choice-list";
import { StepForm } from "./step-form";

const MINUTE_OPTIONS = ["15", "30", "45", "60", "120"] as const;
const DAYS_PER_WEEK = 7;
const EVERY_DAY = Array.from({ length: DAYS_PER_WEEK }, (_, day) => day);
/** A Sunday, so weekday names come out in order from Sunday (0). */
const FIRST_SUNDAY = Date.parse("2023-01-01T00:00:00Z");
const MINUTES_PER_HOUR = 60;

const STUDY_MOMENTS = ["07:00", "12:30", "18:00", "21:30"] as const;

/** One of the usual moments, or the exact time the learner already said ("HH:MM"). */
type StudyMoment = string;

function useMinuteChoices(): Choice<(typeof MINUTE_OPTIONS)[number]>[] {
  const t = useExtracted();

  return MINUTE_OPTIONS.map((value) => {
    const minutes = Number(value);

    return {
      label:
        minutes < MINUTES_PER_HOUR
          ? t("{minutes, number} min", { minutes })
          : t("{hours, plural, one {# hour} other {# hours}}", {
              hours: minutes / MINUTES_PER_HOUR,
            }),
      value,
    };
  });
}

function useMomentLabel() {
  const t = useExtracted();
  const formatTimeOfDay = useFormatTimeOfDay();

  return (moment: StudyMoment): string => {
    switch (moment) {
      case "07:00":
        // Answers to "When will you study?": a bare "Morning" reads as "tomorrow" in German and
        // Spanish, and shares its translation with the stats chart's "Morning".
        return t("In the morning");
      case "12:30":
        return t("At lunch");
      case "18:00":
        return t("After school or work");
      case "21:30":
        return t("Before bed");
      default:
        return formatTimeOfDay(moment);
    }
  };
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
                "in-data-[mode=fun]:aria-pressed:bg-fun-lime in-data-[mode=fun]:aria-pressed:text-fun-lime-foreground",
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

function MomentChips({
  moment,
  moments,
  onChange,
}: {
  moment: StudyMoment | null;
  moments: StudyMoment[];
  onChange: (moment: StudyMoment | null) => void;
}) {
  const t = useExtracted();
  const label = useMomentLabel();

  return (
    <fieldset className="flex flex-col">
      <legend className="mb-3 text-base font-semibold">{t("When will you study?")}</legend>
      <div className="flex flex-wrap gap-2">
        {moments.map((item) => (
          <Toggle
            className="in-data-[mode=fun]:fun-glass aria-pressed:border-foreground in-data-[mode=fun]:aria-pressed:border-fun-lime h-11 rounded-full px-4"
            key={item}
            onPressedChange={(pressed) => onChange(pressed ? item : null)}
            pressed={moment === item}
            variant="outline"
          >
            {label(item)}
          </Toggle>
        ))}
      </div>
    </fieldset>
  );
}

/** The usual moments, with the time the learner already said among them when it's another. */
function getMoments(stated: string | null): StudyMoment[] {
  const usual: StudyMoment[] = [...STUDY_MOMENTS];
  return stated && !usual.includes(stated) ? [...usual, stated].toSorted() : usual;
}

/**
 * How much time a day, on which days and when: the day's time becomes the plan, and Today is
 * ready by then. Any amount works; consistency matters more than length. A time the learner
 * already said comes preselected.
 */
export function ScheduleStep({
  defaultMinutes,
  defaultStudyTime = null,
  onAnswer,
  pending,
}: {
  defaultMinutes: number;
  /** The time they already said they study ("HH:MM"), if any. */
  defaultStudyTime?: string | null;
  onAnswer: (input: OnboardingAnswerInput) => void;
  pending: boolean;
}) {
  const t = useExtracted();
  const choices = useMinuteChoices();
  const formatDuration = useFormatDuration();
  const initial = choices.find((choice) => Number(choice.value) === defaultMinutes)?.value ?? "15";
  const [minutes, setMinutes] = useState<string>(initial);
  const [days, setDays] = useState<number[]>(EVERY_DAY);
  const [moment, setMoment] = useState<StudyMoment | null>(defaultStudyTime);
  const weekly = Number(minutes) * days.length;

  return (
    <StepForm
      canContinue={days.length > 0}
      description={t("Even 15 minutes makes a difference. You can change this anytime.")}
      onContinue={() =>
        onAnswer({
          dailyMinutes: Number(minutes),
          question: "schedule",
          studyDays: days.length === EVERY_DAY.length ? undefined : days,
          studyTime: moment,
          timeZone: getLocalTimeZone(),
        })
      }
      pending={pending}
      title={t("How much time can you study each day?")}
    >
      <ChoiceList
        choices={choices}
        label={t("Minutes a day")}
        onChange={(value) => setMinutes(value)}
        value={choices.find((choice) => choice.value === minutes)?.value ?? null}
      />

      <WeekdayToggles days={days} onChange={setDays} />

      <p aria-live="polite" className="text-muted-foreground text-sm">
        {t("{days, plural, one {# day} other {# days}} · {time} a week", {
          days: days.length,
          time: formatDuration(weekly),
        })}
      </p>

      <MomentChips moment={moment} moments={getMoments(defaultStudyTime)} onChange={setMoment} />
    </StepForm>
  );
}
