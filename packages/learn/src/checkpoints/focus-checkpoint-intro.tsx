"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { RotateCcwIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useCheckpointScreen } from "./checkpoint-context";
import { CheckpointFrame, CheckpointStartFooter } from "./checkpoint-frame";
import { useCheckpointEyebrow, useCheckpointRules } from "./checkpoint-labels";

function useWorthLine(): string {
  const t = useExtracted();
  const format = useFormatter();
  const { checkpoint } = useCheckpointScreen();
  const points = format.number(checkpoint.reward.brainPower);

  if (checkpoint.kind === "weekly") {
    return t("Finishing adds {points} Brain Power.", { points });
  }

  return t("Passing checks off the phase and adds {points} Brain Power.", { points });
}

function useFocusTitle(): string {
  const t = useExtracted();
  const { checkpoint } = useCheckpointScreen();

  if (checkpoint.kind === "weekly") {
    return checkpoint.title ?? t("This week's skills");
  }

  return checkpoint.phase?.name || checkpoint.title || t("Everything in this phase");
}

/**
 * Focus: the phase checkpoint or the weekly challenge, said plainly. The same questions, pass
 * mark and reward as Fun's boss, without the duel.
 */
export function FocusCheckpointIntro() {
  const t = useExtracted();
  const { checkpoint } = useCheckpointScreen();
  const eyebrow = useCheckpointEyebrow(checkpoint);
  const rules = useCheckpointRules(checkpoint);
  const worth = useWorthLine();
  const title = useFocusTitle();

  return (
    <CheckpointFrame footer={<CheckpointStartFooter>{t("Start")}</CheckpointStartFooter>}>
      <div className="flex flex-col gap-2 pt-6">
        <p className="text-muted-foreground text-sm font-medium">{eyebrow}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-foreground">{rules}</p>

        <p className="text-muted-foreground text-sm">{worth}</p>
      </div>

      {checkpoint.rematch && (
        <p className="text-muted-foreground flex items-start gap-2 text-sm">
          <LineMarker>
            <RotateCcwIcon aria-hidden="true" className="size-4" />
          </LineMarker>
          {t("A second try, after practicing what tripped you up.")}
        </p>
      )}

      {!checkpoint.rematch && checkpoint.kind !== "weekly" && (
        <p className="text-muted-foreground flex items-start gap-2 text-sm">
          <LineMarker>
            <RotateCcwIcon aria-hidden="true" className="size-4" />
          </LineMarker>
          {t(
            "If you don't pass, {lessons} short lessons come first, then a second try tomorrow. The next phase stays open.",
            { lessons: String(checkpoint.reinforcementLessons) },
          )}
        </p>
      )}
    </CheckpointFrame>
  );
}
