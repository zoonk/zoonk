"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import { Button } from "@zoonk/ui/components/button";
import { CalendarClockIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { BuddySpeech, useBuddyLine } from "../buddies/buddy-lines";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { TaskFrame, TaskMainLink } from "../shell/task-frame";

/**
 * After "Move to Monday" on the week's challenge or mock: where it went, that nothing is lost,
 * and an undo while the plan is as the move left it. Fun's buddy says it in one line.
 */
export function MovedScreen({
  date,
  error,
  exitHref,
  onUndo,
  pending,
  buddy,
}: {
  /** The new day, as a view model's calendar day. */
  date: string;
  /** Says when the undo didn't go through. */
  error: React.ReactNode;
  exitHref: string;
  /** Null once the plan changed after the move, so there's nothing to undo. */
  onUndo: (() => void) | null;
  pending: boolean;
  buddy: LearnBuddy | null;
}) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const line = useBuddyLine("challengeMoved");

  return (
    <TaskFrame
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
        {buddy ? (
          <div className="flex flex-col items-center gap-2">
            <BuddySpeech>{line}</BuddySpeech>
            <Buddy
              beltColor={buddy.beltColor}
              className="size-28"
              energy={buddy.energy}
              expression="kind"
              glasses={buddy.glasses}
              kind={buddy.kind}
              studiedToday={buddy.studiedToday}
            />
          </div>
        ) : (
          <CalendarClockIcon aria-hidden="true" className="text-muted-foreground size-10" />
        )}

        <h1 className="in-data-[mode=fun]:font-fun-display text-2xl font-bold text-balance">
          {t("Moved to {date}", { date: formatDate(date, "long") })}
        </h1>
        <p className="text-muted-foreground max-w-sm text-balance">
          {t("Your plan made room for it. Nothing is lost.")}
        </p>
      </div>
    </TaskFrame>
  );
}
