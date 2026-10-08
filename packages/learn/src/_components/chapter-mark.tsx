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

/**
 * A chapter's mark in a list: a filled play for the next one, a ring for one begun, a filled check
 * once done, an empty circle ahead. The Journey's path and a subject's chapters use the same marks.
 */
export function ChapterMark({ chapter, isNext }: { chapter: MarkedChapter; isNext: boolean }) {
  const t = useExtracted();
  const { lessonsDone, lessonsTotal, state, writing } = chapter;

  if (isNext) {
    return <StatusMark status="next" />;
  }

  if (state !== "done" && !writing && lessonsDone > 0 && lessonsTotal > 0) {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center">
        <ProgressRing className="size-5" share={lessonsDone / lessonsTotal} />
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
    return <StatusMark label={t("Done")} status="done" />;
  }

  return <StatusMark status="todo" />;
}
