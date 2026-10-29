"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { KindMark } from "../_components/kind-tile";
import { ChangeSaveError } from "../_components/save-error";
import { useSessionAction } from "../session/use-session-action";
import { NO_FOLD, type RowFold, getRowClass } from "./today-block-row";
import { useTodayScreen } from "./today-context";

function PrepareLessonsLine() {
  const t = useExtracted();
  const { actions } = useTodayScreen();
  const { failed, isPending, run } = useSessionAction({ action: actions.prepareLessons });

  return (
    <>
      <p className="text-muted-foreground text-xs leading-4">
        {t("Not written yet.")}{" "}
        <Button disabled={isPending} onClick={run} variant="link">
          {t("Get today's lessons")}
        </Button>
      </p>

      {failed && <ChangeSaveError className="text-xs" />}
    </>
  );
}

/**
 * Holds the place of the day's lessons that aren't written yet: Today reads again until they land
 * while they're outlined, and asks the learner for them while nobody is.
 */
export function ComingLessonsRow({ fold = NO_FOLD }: { fold?: RowFold }) {
  const t = useExtracted();
  const { today, writingStalled } = useTodayScreen();

  return (
    <li
      className={getRowClass({ finished: false, fold, isNext: false })}
      data-slot="today-coming-lessons"
    >
      <span className="flex h-5 w-3 shrink-0 items-center justify-center">
        <KindMark kind="lesson" />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate text-sm leading-5 font-medium">{t("Your next lessons")}</span>

        {today.session.lessonsToPrepare ? (
          <PrepareLessonsLine />
        ) : (
          <span className="text-muted-foreground truncate text-xs leading-4">
            {writingStalled ? t("Taking longer than usual") : t("Being written for you…")}
          </span>
        )}
      </div>
    </li>
  );
}
