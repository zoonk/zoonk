"use client";

import { type ChapterView } from "@zoonk/core/view-models/chapter/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { RocketIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { LearnLink } from "../learn-link";
import { useExperienceMode } from "../mode-provider";
import {
  type ChapterActions,
  type ChapterHrefs,
  ChapterScreenProvider,
  useChapterScreen,
  useLessonHref,
} from "./chapter-context";
import { ChapterHeader } from "./chapter-header";
import { ChapterLessons, useNextLesson } from "./chapter-lessons";
import { ChapterMapCard } from "./chapter-map-card";
import { ChapterPractice, ChapterSummaries } from "./chapter-practice";

export type { ChapterHrefs } from "./chapter-context";

/** Fun leads with the next lesson and its lime launch: "Next lesson · 2 of 4". */
function FunNextLesson() {
  const t = useExtracted();
  const lessonHref = useLessonHref();
  const { chapter } = useChapterScreen();
  const next = useNextLesson();

  if (!next) {
    return null;
  }

  const number = chapter.lessons.findIndex((lesson) => lesson.lessonId === next.lessonId) + 1;

  return (
    <div className="fun-glass flex flex-col gap-3 rounded-3xl p-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-fun-accent-cyan text-xs font-semibold tracking-widest uppercase">
          {t("Next lesson · {number, number} of {total, number}", {
            number,
            total: chapter.lessons.length,
          })}
        </p>
        <p className="font-semibold">{next.title}</p>
      </div>
      <LearnLink
        className={cn(buttonVariants({ size: "lg", variant: "lime" }), "h-12 w-full text-base")}
        href={lessonHref(next.lessonId)}
      >
        <RocketIcon aria-hidden="true" />
        {t("Take off · {minutes, number} min", { minutes: next.minutes })}
      </LearnLink>
    </div>
  );
}

function ChapterBody() {
  const mode = useExperienceMode();
  const { chapter } = useChapterScreen();

  return (
    <div className="flex flex-col gap-4" data-slot="chapter">
      <ChapterHeader />
      {mode === "fun" && <FunNextLesson />}
      <ChapterMapCard />
      {chapter.lessons.length > 0 && <ChapterLessons lessons={chapter.lessons} />}
      <ChapterPractice />
      <ChapterSummaries />
    </div>
  );
}

/**
 * A chapter of the learner's plan, in Focus and Fun alike: its number, level and lessons done,
 * the map of its skills, its lessons with the next one to open, mistakes to practice and the
 * summary cards its lessons left. Fun leads with the next lesson's launch.
 *
 * ```tsx
 * <ChapterScreen
 *   actions={{ practice }}
 *   chapter={chapter}
 *   hrefs={{ back: "/content", lessonBasePath: "/learn", mistakes: "/mistakes" }}
 * />
 * ```
 */
export function ChapterScreen({
  actions,
  ask,
  chapter,
  hrefs,
}: {
  actions: ChapterActions;
  /** "Ask" about the chapter, such as the player's `AskTutor`; the host decides who can ask. */
  ask?: React.ReactNode;
  chapter: ChapterView;
  hrefs: ChapterHrefs;
}) {
  return (
    <ChapterScreenProvider value={{ actions, ask, chapter, hrefs }}>
      <ChapterBody />
    </ChapterScreenProvider>
  );
}
