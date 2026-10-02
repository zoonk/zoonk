"use client";

import { type PlanChapterView } from "@zoonk/core/plans/view-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { LearnLink } from "../learn-link";
import { usePlanScreen } from "./plan-context";

/** Chapters the learner hasn't finished can be tested out; outlines without a chapter can't yet. */
export function canTestOut(
  chapter: PlanChapterView,
): chapter is PlanChapterView & { chapterId: string } {
  return chapter.state !== "done" && chapter.chapterId !== null;
}

/** A quick test that skips a chapter the learner already knows. The same entry in both modes. */
export function ChapterTestOutLink({
  chapter,
  className,
  children,
}: {
  chapter: PlanChapterView & { chapterId: string };
  className?: string;
  children: React.ReactNode;
}) {
  const t = useExtracted();
  const { testOutBasePath } = usePlanScreen();

  return (
    <LearnLink
      className={cn(
        "focus-visible:ring-ring/50 inline-flex min-h-11 shrink-0 items-center rounded-full outline-none focus-visible:ring-[3px]",
        className,
      )}
      href={`${testOutBasePath}/${chapter.chapterId}`}
      prefetch={false}
    >
      <span aria-hidden="true" className="min-w-0 flex-1">
        {children}
      </span>
      <span className="sr-only">{t("Test out of {chapter}", { chapter: chapter.title })}</span>
    </LearnLink>
  );
}
