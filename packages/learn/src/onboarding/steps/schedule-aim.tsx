"use client";

import { type LanguageAim, type LanguageAimView } from "@zoonk/core/language/aims";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useFormatDuration } from "../../_utils/time-format";
import { AimName, AimPicker } from "../../language-aim/aim-picker";
import { useAimEnds } from "../../language-aim/use-aim-ends";
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
  readEnd,
}: {
  /** When the plan reaches the aim at the time shown; null while it isn't known. */
  endDate: string | null;
  languageAim: LanguageAimView | null;
  level: unknown;
  minutes: number | null;
  onChangeAim: (aim: LanguageAim) => Promise<boolean>;
  /** When another aim would be reached at the time shown, as the line under it would say once picked. */
  readEnd: (aim: LanguageAim) => Promise<string | null>;
}) {
  const t = useExtracted();
  const words = useAimWords();
  const fromLevel = useFromLevel();
  const { ask, ends } = useAimEnds(readEnd);

  if (!languageAim?.aim || languageAim.choices.length === 0) {
    return null;
  }

  const { aim, choices } = languageAim;

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
        onOpen={() => ask(choices.flatMap((choice) => (choice.aim === aim ? [] : [choice.aim])))}
        onPick={onChangeAim}
        options={choices.map((choice) => ({
          aim: choice.aim,
          detail: words.left({
            endDate: choice.aim === aim ? endDate : (ends[choice.aim] ?? null),
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
