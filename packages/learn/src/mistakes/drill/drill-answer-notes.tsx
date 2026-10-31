"use client";

import { HandIcon, TimerOffIcon, TriangleAlertIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type Drill } from "./drill-types";

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
          {t({
            description: '"It" is the question: it comes back in later practice.',
            message: "Time's up. It counts as a miss, so it comes back.",
          })}
        </p>
      )}

      {notSure && drill?.kind === "noGuessing" && (
        <p className="flex items-start gap-2 text-sm">
          <HandIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("Good call. Saying you're not sure beats a guess.")}
        </p>
      )}

      {trap && (
        <p className="text-muted-foreground flex items-start gap-2 text-sm">
          <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-medium">{t("The trap:")}</span> {trap}
          </span>
        </p>
      )}
    </>
  );
}
