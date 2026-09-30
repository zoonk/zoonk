"use client";

import { type ChapterLessonView } from "@zoonk/core/view-models/chapter/contract";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheckIcon, CircleIcon, CirclePlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { LearnLink } from "../learn-link";
import { useChapterScreen, useLessonHref } from "./chapter-context";

const LESSON_ICONS = { done: CircleCheckIcon, next: CirclePlayIcon, upcoming: CircleIcon } as const;

function useLessonStateLabel() {
  const t = useExtracted();

  return (state: ChapterLessonView["state"]) => {
    if (state === "done") {
      return t("Done");
    }

    return state === "next" ? t("Next") : t("Coming up");
  };
}

function LessonRowContent({ lesson }: { lesson: ChapterLessonView }) {
  const t = useExtracted();
  const stateLabel = useLessonStateLabel();
  const Icon = LESSON_ICONS[lesson.state];

  // The icon and the minutes sit on the title's first line when a long title wraps.
  return (
    <>
      <LineMarker>
        <Icon
          aria-label={stateLabel(lesson.state)}
          role="img"
          className={cn(
            "size-5",
            lesson.state === "done" && "text-success",
            lesson.state === "upcoming" && "text-muted-foreground",
          )}
        />
      </LineMarker>
      <span
        className={cn(
          "min-w-0 flex-1",
          lesson.state === "done" && "text-muted-foreground",
          lesson.state === "next" && "font-semibold",
        )}
      >
        {lesson.title}
      </span>
      {lesson.minutes > 0 && (
        <span className="text-muted-foreground shrink-0 text-sm leading-6 tabular-nums">
          {t("{minutes, number} min", { minutes: lesson.minutes })}
        </span>
      )}
    </>
  );
}

/**
 * The chapter's lessons in order: finished ones, the next one to open (highlighted) and the rest.
 * Finished lessons and the next one open in the player; later ones wait their turn.
 */
export function ChapterLessons({ lessons }: { lessons: ChapterLessonView[] }) {
  const t = useExtracted();
  const lessonHref = useLessonHref();
  const rowClass = "flex items-start gap-3 rounded-xl px-3 py-3";

  return (
    <section
      aria-labelledby="chapter-lessons-title"
      className="bg-card ring-foreground/10 in-data-[mode=fun]:fun-glass flex flex-col gap-2 rounded-3xl p-4 ring-1 in-data-[mode=fun]:ring-0"
    >
      <h2 className="px-1 text-base font-semibold" id="chapter-lessons-title">
        {t("Lessons")}
      </h2>
      <ul className="flex flex-col gap-1">
        {lessons.map((lesson) => (
          <li data-state={lesson.state} key={lesson.lessonId}>
            {lesson.state === "upcoming" ? (
              <div className={rowClass}>
                <LessonRowContent lesson={lesson} />
              </div>
            ) : (
              <LearnLink
                className={cn(
                  rowClass,
                  "hover:bg-muted focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
                  lesson.state === "next" && "bg-muted",
                )}
                href={lessonHref(lesson.lessonId)}
              >
                <LessonRowContent lesson={lesson} />
              </LearnLink>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The lesson to open now, if the chapter has one left. */
export function useNextLesson() {
  const { chapter } = useChapterScreen();
  return chapter.lessons.find((lesson) => lesson.state === "next") ?? null;
}
