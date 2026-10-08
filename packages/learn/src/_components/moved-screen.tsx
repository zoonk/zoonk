"use client";

import { Button } from "@zoonk/ui/components/button";
import { CalendarClockIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { TaskFrame, TaskMainLink } from "../shell/task-frame";

/**
 * After "Move to Monday" on the week's challenge or mock: where it went, that nothing is lost,
 * and an undo while the plan is as the move left it.
 */
export function MovedScreen({
  date,
  error,
  exitHref,
  onUndo,
  pending,
}: {
  /** The new day, as a view model's calendar day. */
  date: string;
  /** Says when the undo didn't go through. */
  error: React.ReactNode;
  exitHref: string;
  /** Null once the plan changed after the move, so there's nothing to undo. */
  onUndo: (() => void) | null;
  pending: boolean;
}) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return (
    <TaskFrame
      closeOnEscape
      exitHref={exitHref}
      footer={
        <>
          {error}
          <TaskMainLink href={exitHref}>{t("Back to Today")}</TaskMainLink>
          {onUndo && (
            <Button
              className="w-full"
              disabled={pending}
              onClick={onUndo}
              size="lg"
              variant="ghost"
            >
              {t("Undo")}
            </Button>
          )}
        </>
      }
    >
      <div
        className="flex flex-1 flex-col items-center justify-center gap-4 text-center"
        role="status"
      >
        <CalendarClockIcon aria-hidden="true" className="text-muted-foreground size-10" />

        <h1 className="text-2xl font-bold text-balance">
          {t("Moved to {date}", { date: formatDate(date, "long") })}
        </h1>
        <p className="text-muted-foreground max-w-sm text-balance">
          {t("Your plan made room for it. Nothing is lost.")}
        </p>
      </div>
    </TaskFrame>
  );
}
