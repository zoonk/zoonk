"use client";

import { type LanguageAim, type LanguageAimView } from "@zoonk/core/language/aims";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { AimName, AimPicker } from "../../language-aim/aim-picker";
import { useAimEnds } from "../../language-aim/use-aim-ends";
import { useAimWords } from "../../language-aim/use-aim-words";

/** The aim's own choices, so a learner past their aim isn't told when they'll reach it. */
export function getAimAhead(languageAim: LanguageAimView | null): LanguageAim | null {
  return languageAim?.choices.find((choice) => choice.aim === languageAim.aim)?.aim ?? null;
}

/** The aim sizes the course, so it sits by the time it's reached in, one tap from changing. */
export function ScheduleAim({
  endDate,
  languageAim,
  onChangeAim,
  readEnd,
}: {
  /** When the plan reaches the aim at the time shown; null while it isn't known. */
  endDate: string | null;
  languageAim: LanguageAimView | null;
  onChangeAim: (aim: LanguageAim) => Promise<boolean>;
  /** When another aim would be reached at the time shown, as the line under it would say once picked. */
  readEnd: (aim: LanguageAim) => Promise<string | null>;
}) {
  const t = useExtracted();
  const words = useAimWords();
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
        onOpen={() => ask(choices.flatMap((choice) => (choice.aim === aim ? [] : [choice.aim])))}
        onPick={onChangeAim}
        options={choices.map((choice) => ({
          aim: choice.aim,
          detail: words.around(choice.aim === aim ? endDate : (ends[choice.aim] ?? null)),
        }))}
        trigger={<Button className="shrink-0" size="sm" type="button" variant="outline" />}
        value={aim}
      >
        {t("Change")}
      </AimPicker>
    </div>
  );
}
