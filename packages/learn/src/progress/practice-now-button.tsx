"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PracticeOutcomeMessage } from "../_components/practice-outcome-message";
import { usePracticeRun } from "../_utils/use-practice-run";
import { useProgressScreen } from "./progress-context";

/**
 * "Practice now" on the area where practice pays the most: a short bonus block on that area's
 * skills, added to today's session and opened right away.
 */
export function PracticeNowButton({ areaId, className }: { areaId: string; className?: string }) {
  const t = useExtracted();
  const { actions } = useProgressScreen();
  const { isPending, outcome, practice } = usePracticeRun(() => actions.practiceArea(areaId));

  return (
    <div className="flex flex-col items-end gap-2">
      <Button className={cn(className)} disabled={isPending} onClick={practice} size="sm">
        <PlayIcon aria-hidden="true" data-icon="inline-start" />
        {t("Practice now")}
      </Button>
      <PracticeOutcomeMessage
        dailyCap={t(
          "That's all the bonus practice for today. Tomorrow's session picks this area up.",
        )}
        nothingToPractice={t("Nothing left to practice in this area today.")}
        outcome={outcome}
      />
    </div>
  );
}
