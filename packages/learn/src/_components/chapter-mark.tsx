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
 * A chapter's mark in a list, in `StatusMark`'s marks: the learner's blue dot for the next one, a
 * small ring for one begun, a blue check once done, a skip mark once done without studying it
 * (`skipped`: the learner showed they know it), a faint dot ahead. The Plan's path and a
 * subject's chapters use the same marks.
 */
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
