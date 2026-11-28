"use client";

import { type LanguageAim, type LanguageAimView } from "@zoonk/core/language/aims";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { type FinishForecast } from "../../_components/finish-readout";
import { AimName, AimPicker } from "../../language-aim/aim-picker";
import { useAimEnds } from "../../language-aim/use-aim-ends";
import { useAimWords } from "../../language-aim/use-aim-words";

/** The aim sizes the course, so it sits by the time it's reached in, one tap from changing. */
export function ScheduleAim({
  forecast,
  languageAim,
  onChangeAim,
  readEnd,
}: {
  /** When the plan reaches the aim at the time shown; null while it isn't known. */
  forecast: FinishForecast | null;
  languageAim: LanguageAimView | null;
  onChangeAim: (aim: LanguageAim) => Promise<boolean>;
  /** When another aim would be reached at the time shown, as the line under it would say once picked. */
  readEnd: (aim: LanguageAim) => Promise<FinishForecast | null>;
}) {
  const t = useExtracted();
  const words = useAimWords();
  const { ask, ends } = useAimEnds(readEnd);

  if (!languageAim?.aim || languageAim.choices.length === 0) {
    return null;
  }

  const { aim, choices } = languageAim;
  const named = languageAim.label ?? aim;

  return (
    <div className="flex items-center gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-muted-foreground text-compact">
          {words.title(languageAim.targetLanguage)}
        </span>
        <span className="text-reading font-medium">
          <AimName aim={named} />
        </span>
      </div>

      <AimPicker
        onOpen={() => ask(choices.flatMap((choice) => (choice.aim === aim ? [] : [choice.aim])))}
        onPick={onChangeAim}
        options={choices.map((choice) => ({
          aim: choice.aim,
          detail: words.around(choice.aim === aim ? forecast : (ends[choice.aim] ?? null)),
          name: choice.aim === aim ? named : undefined,
        }))}
        trigger={<Button className="shrink-0" size="lg" type="button" variant="outline" />}
        value={named}
      >
        {t("Change")}
      </AimPicker>
    </div>
  );
}
