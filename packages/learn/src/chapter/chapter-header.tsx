"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { BookOpenIcon, ChevronLeftIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useLevelName } from "../course/use-level-name";
import { ContentVoteMenu } from "../feedback/content-vote-menu";
import { UnitLessonsBar } from "../language/unit-parts";
import { LearnLink } from "../learn-link";
import { useExperienceMode } from "../mode-provider";
import { FunMoon } from "../plan/fun-moon";
import { useChapterScreen } from "./chapter-context";

/** A chapter's mark: a book in Focus and its moon on the route in Fun, colored by its number. */
function ChapterBadge({ position }: { position: number }) {
  const mode = useExperienceMode();

  if (mode === "fun") {
    return <FunMoon index={position - 1} size="lg" />;
  }

  return (
    <span
      aria-hidden="true"
      className="bg-muted text-muted-foreground flex size-16 shrink-0 items-center justify-center rounded-3xl"
    >
      <BookOpenIcon className="size-7" />
    </span>
  );
}

/**
 * Back to Content with the chapter's "…" menu, "Chapter 3 · Overview", the chapter's title and
 * its lessons done.
 */
export function ChapterHeader() {
  const t = useExtracted();
  const levelName = useLevelName();
  const { ask, chapter, hrefs } = useChapterScreen();
  const done = chapter.lessons.filter((lesson) => lesson.state === "done").length;

  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <LearnLink
          className={cn(
            buttonVariants({ size: "sm", variant: "ghost" }),
            "in-data-[mode=fun]:fun-glass -ml-2",
          )}
          href={hrefs.back}
        >
          <ChevronLeftIcon aria-hidden="true" />
          {t("Content")}
        </LearnLink>

        <div className="flex items-center gap-1">
          {ask}
          <ContentVoteMenu
            label={t("Chapter options")}
            screen="chapter"
            target={{ contentId: chapter.chapter.chapterId, contentKind: "chapter" }}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <ChapterBadge position={chapter.chapter.position} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-muted-foreground text-sm font-medium in-data-[mode=fun]:text-xs in-data-[mode=fun]:tracking-widest in-data-[mode=fun]:uppercase">
            {t("Chapter {number, number} · {level}", {
              level: levelName(chapter.chapter.level),
              number: chapter.chapter.position,
            })}
          </p>
          <h1 className="in-data-[mode=fun]:font-fun-display text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            {chapter.chapter.title}
          </h1>
        </div>
      </div>

      {chapter.lessons.length > 0 && <UnitLessonsBar done={done} total={chapter.lessons.length} />}
    </header>
  );
}
