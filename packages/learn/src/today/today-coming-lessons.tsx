"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { KindMark } from "../_components/kind-tile";
import { ChangeSaveError } from "../_components/save-error";
import { TITLE_ROW_CLASS, TRUNCATED_TITLE_CLASS } from "../_components/title-row";
import { useFormatDuration } from "../_utils/time-format";
import { useSessionAction } from "../session/use-session-action";
import { getRowClass } from "./today-block-row";
import { useTodayScreen } from "./today-context";
import { getHeldMinutes } from "./today-time";

/**
 * The day's time held for lessons not written yet, named by the plan's topic they come from. Once
 * nobody is writing them, or the wait for them ran out, the learner asks for them.
 */
export function useComingLessons(): { asks: boolean; title: string } {
  const t = useExtracted();
  const { today, writingStalled } = useTodayScreen();

  return {
    asks: today.session.lessonsToPrepare || writingStalled,
    title: today.session.lessonPlaceholder?.title ?? t("Your next lessons"),
  };
}

/** The row's time, or the learner's ask for its lessons in its place while nobody is writing them. */
function ComingLessonsValue({ asks, minutes }: { asks: boolean; minutes: number }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { actions } = useTodayScreen();
  const { failed, isPending, run } = useSessionAction({ action: actions.prepareLessons });

  if (!asks) {
    return (
      minutes > 0 && (
        <span className="text-muted-foreground flex h-5 items-center font-mono text-xs tabular-nums">
          {formatDuration(minutes)}
        </span>
      )
    );
  }

  return (
    <>
      <Button busy={isPending} size="sm" onClick={run} variant="outline">
        {t({
          description: "Button that asks for today's lessons to be made ready.",
          message: "Get lessons",
        })}
      </Button>

      {failed && <ChangeSaveError className="basis-full text-xs" />}
    </>
  );
}

/** Holds the place of the day's lessons that aren't ready yet, where the plan puts them. */
export function ComingLessonsRow() {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const { asks, title } = useComingLessons();

  return (
    <li className={getRowClass({ isNext: false })} data-slot="today-coming-lessons">
      <span className="flex h-5 w-4 shrink-0 items-center justify-center">
        <KindMark kind="lesson" />
      </span>

      <div className={cn(TITLE_ROW_CLASS, "min-w-0 flex-1")}>
        <div className="flex flex-col gap-px">
          <span className={cn(TRUNCATED_TITLE_CLASS, "text-sm leading-5 font-medium")}>
            {title}
          </span>

          <span className="text-muted-foreground truncate text-xs leading-4">
            {asks ? t("Not ready yet") : t("Getting ready…")}
          </span>
        </div>

        <ComingLessonsValue asks={asks} minutes={getHeldMinutes(today.session)} />
      </div>
    </li>
  );
}
