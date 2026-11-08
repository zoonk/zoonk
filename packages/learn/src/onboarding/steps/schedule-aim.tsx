"use client";

import { type LanguageAim, type LanguageAimView } from "@zoonk/core/language/aims";
import { Button } from "@zoonk/ui/components/button";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { useExtracted } from "next-intl";
import { getTodayInZone } from "../../_utils/iso-date";
import { useFormatDuration } from "../../_utils/time-format";
import { getAimEndDate } from "../../language-aim/aim-end-date";
import { AimName, AimPicker } from "../../language-aim/aim-picker";
import { useAimWords } from "../../language-aim/use-aim-words";

/** The aim's own choices, so a learner past their aim isn't told when they'll reach it. */
export function getAimAhead(languageAim: LanguageAimView | null): LanguageAim | null {
  return languageAim?.choices.find((choice) => choice.aim === languageAim.aim)?.aim ?? null;
}

function useFromLevel() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return ({ level, minutes }: { level: unknown; minutes: number }) =>
    t({
      description:
        'Under "How far do you want to go?": where the learner starts and their daily time. {level} is their level when it is a CEFR label, like "B1+".',
      message:
        "{level, select, none {From scratch, at {time} a day.} basic {From the basics, at {time} a day.} intermediate {From an intermediate level, at {time} a day.} advanced {From an advanced level, at {time} a day.} other {From {level}, at {time} a day.}}",
      values: { level: typeof level === "string" ? level : "none", time: formatDuration(minutes) },
    });
}

/** The aim sizes the course, so it sits by the time it's reached in, one tap from changing. */
export function ScheduleAim({
  endDate,
  languageAim,
  level,
  minutes,
  onChangeAim,
  timeZone,
}: {
  /** When the plan reaches the aim at the time shown; null while it isn't known. */
  endDate: string | null;
  languageAim: LanguageAimView | null;
  level: unknown;
  minutes: number | null;
  onChangeAim: (aim: LanguageAim) => Promise<boolean>;
  timeZone: string | null;
}) {
  const t = useExtracted();
  const words = useAimWords();
  const fromLevel = useFromLevel();
  const today = getTodayInZone({ now: useMountTime(), timeZone });

  if (!languageAim?.aim || languageAim.choices.length === 0) {
    return null;
  }

  const { aim, choices } = languageAim;
  const current = choices.find((choice) => choice.aim === aim)?.hours ?? 0;

  return (
    <div className="flex items-center gap-3 border-y py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-muted-foreground text-[0.8125rem]">{words.title}</span>
        <span className="text-[0.9375rem] font-medium text-pretty">
          <AimName aim={aim} />
        </span>
      </div>

      <AimPicker
        description={minutes === null ? null : fromLevel({ level, minutes })}
        onPick={onChangeAim}
        options={choices.map((choice) => ({
          aim: choice.aim,
          detail: words.left({
            endDate: getAimEndDate({ current, endDate, hours: choice.hours, today }),
            hours: choice.hours,
          }),
        }))}
        trigger={<Button className="shrink-0" size="sm" type="button" variant="outline" />}
        value={aim}
      >
        {t("Change")}
      </AimPicker>
    </div>
  );
}
