"use client";

import { HandIcon, TimerOffIcon, TriangleAlertIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type Drill } from "./drill-types";

/**
 * What a drill adds after an answer: time running out, an honest "I'm not sure" in a no-guessing
 * drill, and the trap a trap drill names.
 */
export function DrillAnswerNotes({
  drill,
  notSure,
  timedOut,
  trap,
}: {
  drill: Drill | null;
  notSure: boolean;
  timedOut: boolean;
  trap: string | null;
}) {
  const t = useExtracted();

  return (
    <>
      {timedOut && (
        <p className="flex items-start gap-2 text-sm">
          <TimerOffIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("Time's up. It counts as a miss, so it comes back.")}
        </p>
      )}

      {notSure && drill?.kind === "noGuessing" && (
        <p className="flex items-start gap-2 text-sm">
          <HandIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("Good call. Saying you're not sure beats a guess.")}
        </p>
      )}

      {trap && (
        <p className="bg-background/60 in-data-[mode=fun]:bg-fun-soft flex items-start gap-2 rounded-xl px-3 py-2 text-sm">
          <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-medium">{t("The trap:")}</span> {trap}
          </span>
        </p>
      )}
    </>
  );
}
