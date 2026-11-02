"use client";

import { useExtracted } from "next-intl";
import { ProgressRing } from "./progress-ring";
import { StatusMark } from "./status-mark";

type MarkedChapter = {
  lessonsDone: number;
  lessonsTotal: number;
  state: "current" | "done" | "upcoming";
  writing: boolean;
};

export function ChapterMark({
  chapter,
  isNext,
  skipped = false,
}: {
  chapter: MarkedChapter;
  isNext: boolean;
  skipped?: boolean;
}) {
  const t = useExtracted();
  const { lessonsDone, lessonsTotal, state, writing } = chapter;

  if (isNext) {
    return <StatusMark label={t("Up next")} status="next" />;
  }

  if (state !== "done" && !writing && lessonsDone > 0 && lessonsTotal > 0) {
    return (
      <span className="flex size-4 shrink-0 items-center justify-center">
        <ProgressRing className="size-3.5" share={lessonsDone / lessonsTotal} />
        <span className="sr-only">
          {t(
            "{total, plural, one {{done, number} of # lesson done} other {{done, number} of # lessons done}}",
            { done: lessonsDone, total: lessonsTotal },
          )}
        </span>
      </span>
    );
  }

  if (state === "done") {
    return skipped ? (
      <StatusMark label={t("Skipped")} status="skipped" />
    ) : (
      <StatusMark label={t("Done")} status="done" />
    );
  }

  return <StatusMark status="todo" />;
}
