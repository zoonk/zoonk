"use client";

import { useExtracted } from "next-intl";
import { KindMark } from "../_components/kind-tile";
import { NO_FOLD, type RowFold, getRowClass } from "./today-block-row";
import { useTodayScreen } from "./today-context";

/** Holds the place of the day's lessons that aren't written yet; Today reads again until they land. */
export function ComingLessonsRow({ fold = NO_FOLD }: { fold?: RowFold }) {
  const t = useExtracted();
  const { writingStalled } = useTodayScreen();

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
        <span className="text-muted-foreground truncate text-xs leading-4">
          {writingStalled ? t("Taking longer than usual") : t("Being written for you…")}
        </span>
      </div>
    </li>
  );
}
