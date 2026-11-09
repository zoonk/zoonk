"use client";

import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useId } from "react";
import { ChangeSaveError } from "../_components/save-error";
import { AimChoices } from "../language-aim/aim-picker";
import { useAimEnds } from "../language-aim/use-aim-ends";
import { useAimWords } from "../language-aim/use-aim-words";
import { usePlanScreen } from "./plan-context";
import { usePlanChange } from "./use-plan-change";
import { usePreviewBase } from "./use-plan-preview";
import { useTappedChoice } from "./use-tapped-choice";

/**
 * Each aim is dated by previewing its change, as the editor's other changes are, by the one rule the
 * time question follows too (`finishDate`). Asked as the editor opens and after each change, never
 * on loading the page: each one plans the goal again.
 */
function useAimFinishes() {
  const { actions, plan } = usePlanScreen();
  const base = usePreviewBase();

  const { ask, ends } = useAimEnds(async (aim) => {
    const preview = await actions.preview([{ aim, kind: "setAim" }]);
    return preview?.finishDate ?? null;
  });

  const askAll = useEffectEvent((revision: object) => {
    if (revision === base && plan.languageAim) {
      ask(plan.languageAim.choices.map((item) => item.aim));
    }
  });

  useEffect(() => {
    askAll(base);
  }, [base]);

  return ends;
}

/** Only a tap, a number key or Enter applies an aim: the arrow keys move without re-planning. */
export function PlanAim() {
  const t = useExtracted();
  const labelId = useId();
  const words = useAimWords();
  const { plan } = usePlanScreen();
  const { change, failed, isPending } = usePlanChange();
  const languageAim = plan.languageAim;
  const choice = useTappedChoice(languageAim?.aim ?? null);
  const ends = useAimFinishes();

  if (!languageAim || languageAim.choices.length === 0) {
    return null;
  }

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
          detail: words.left({ endDate: ends[item.aim] ?? null, hours: item.hours }),
        }))}
        pending={isPending}
        value={choice.shown}
      />

      {failed && <ChangeSaveError />}
    </section>
  );
}
