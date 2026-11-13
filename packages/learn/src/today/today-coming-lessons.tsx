"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { KindMark } from "../_components/kind-tile";
import { ChangeSaveError } from "../_components/save-error";
import { useSessionAction } from "../session/use-session-action";
import { getRowClass } from "./today-block-row";
import { useTodayScreen } from "./today-context";

function PrepareLessons() {
  const t = useExtracted();
  const { actions } = useTodayScreen();
  const { failed, isPending, run } = useSessionAction({ action: actions.prepareLessons });

  return (
    <>
      <form action={() => void run()} className="contents">
        <Button busy={isPending} size="sm" type="submit" variant="outline">
          {t("Get them now")}
        </Button>
      </form>

      {failed && <ChangeSaveError className="basis-full text-xs" />}
    </>
  );
}

/**
 * Holds the place of the day's lessons that aren't ready yet: Today reads again until they land
 * while they're on the way, and asks the learner for them while nobody is.
 */
export function ComingLessonsRow() {
  const t = useExtracted();
  const { today, writingStalled } = useTodayScreen();
  const asks = today.session.lessonsToPrepare;

  return (
    <li
      className={cn(getRowClass({ finished: false, isNext: false }), "flex-wrap")}
      data-slot="today-coming-lessons"
    >
      <span className="flex h-5 w-4 shrink-0 items-center justify-center">
        <KindMark kind="lesson" />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate text-sm leading-5 font-medium">{t("Your next lessons")}</span>

        <span className="text-muted-foreground truncate text-xs leading-4">
          {asks && t("Not ready yet")}
          {!asks && (writingStalled ? t("Taking longer than usual") : t("Getting ready…"))}
        </span>
      </div>

      {asks && <PrepareLessons />}
    </li>
  );
}
