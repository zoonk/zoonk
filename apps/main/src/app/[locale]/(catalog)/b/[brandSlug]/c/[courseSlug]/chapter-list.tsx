"use client";

import { type ChapterWithLessons } from "@/data/chapters/list-course-chapters";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@zoonk/ui/components/accordion";
import { ChapterEmptyState } from "./chapter-empty-state";
import { ChapterLessonList } from "./chapter-lesson-list";

export function ChapterList({
  brandSlug,
  chapters,
  courseSlug,
  emptyStateText,
  expandedValues,
  onExpandedChange,
}: {
  brandSlug: string;
  chapters: ChapterWithLessons[];
  courseSlug: string;
  emptyStateText?: string;
  expandedValues?: string[];
  onExpandedChange?: (values: string[]) => void;
}) {
  if (chapters.length === 0) {
    if (!emptyStateText) {
      return null;
    }
    return <p className="text-muted-foreground py-8 text-center text-sm">{emptyStateText}</p>;
  }

  return (
    <section>
      <Accordion
        onValueChange={(values) => onExpandedChange?.(values as string[])}
        value={expandedValues}
        variant="ghost"
      >
        {chapters.map((chapter, index) => (
          <AccordionItem key={chapter.id} value={chapter.slug} variant="ghost">
            <AccordionTrigger className="px-0 py-3 hover:no-underline">
              <div className="flex items-baseline gap-1">
                <span className="text-muted-foreground/40 w-5 shrink-0 font-mono leading-snug tabular-nums sm:w-6">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span className="text-left leading-snug font-medium">{chapter.title}</span>
              </div>
            </AccordionTrigger>

            <AccordionContent className="pb-2 [&_a]:no-underline">
              <div className="ml-4 flex flex-col gap-3 sm:ml-6">
                {chapter.description && (
                  <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
                    {chapter.description}
                  </p>
                )}

                {chapter.lessons.length === 0 ? (
                  <ChapterEmptyState chapterId={chapter.id} />
                ) : (
                  <ChapterLessonList
                    brandSlug={brandSlug}
                    chapterSlug={chapter.slug}
                    courseSlug={courseSlug}
                    lessons={chapter.lessons}
                  />
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
