"use client";

import { useExtracted } from "next-intl";
import { useId } from "react";
import { ChangeSaveError } from "../_components/save-error";
import { AimChoices } from "../language-aim/aim-picker";
import { getAimEndDate, useAimWords } from "../language-aim/use-aim-words";
import { usePlanScreen } from "./plan-context";
import { usePlanChange } from "./use-plan-change";
import { useTappedChoice } from "./use-tapped-choice";

/** Only a tap, a number key or Enter applies an aim: the arrow keys move without re-planning. */
export function PlanAim() {
  const t = useExtracted();
  const labelId = useId();
  const words = useAimWords();
  const { plan, today } = usePlanScreen();
  const { change, failed, isPending } = usePlanChange();
  const languageAim = plan.languageAim;
  const choice = useTappedChoice(languageAim?.aim ?? null);

  if (!languageAim || languageAim.choices.length === 0) {
    return null;
  }

  const current = languageAim.choices.find((item) => item.aim === languageAim.aim)?.hours ?? 0;

  return (
    <section aria-labelledby={labelId} className="flex flex-col gap-2">
      <h3 className="text-sm font-medium" id={labelId}>
        {words.title}
      </h3>
      <p className="text-muted-foreground text-sm">
        {t("How far your course goes, which sets how long your plan is.")}
      </p>

      <AimChoices
        numberKeys={false}
        onPick={(aim) => {
          if (aim !== languageAim.aim) {
            void change([{ aim, kind: "setAim" }], choice.pick(aim));
          }
        }}
        options={languageAim.choices.map((item) => ({
          aim: item.aim,
          detail: words.left({
            endDate: getAimEndDate({
              current,
              endDate: plan.estimate.endDate,
              hours: item.hours,
              today,
            }),
            hours: item.hours,
          }),
        }))}
        pending={isPending}
        value={choice.shown}
      />

      {failed && <ChangeSaveError />}
    </section>
  );
}
