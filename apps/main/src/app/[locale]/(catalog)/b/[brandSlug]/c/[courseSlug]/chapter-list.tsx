"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@zoonk/ui/components/accordion";
import type { ChapterWithLessons } from "@/data/chapters/list-course-chapters";
import { ClientLink } from "@/i18n/client-link";

export function ChapterList({
  brandSlug,
  chapters,
  courseSlug,
}: {
  brandSlug: string;
  chapters: ChapterWithLessons[];
  courseSlug: string;
}) {
  if (chapters.length === 0) {
    return null;
  }

  return (
    <section>
      <Accordion className="rounded-none border-0">
        {chapters.map((chapter, index) => (
          <AccordionItem
            className="border-border/30 border-b last:border-b-0 data-open:bg-transparent"
            key={chapter.id}
            value={chapter.slug}
          >
            <AccordionTrigger className="px-0 py-5 hover:no-underline">
              <div className="flex items-start gap-4">
                <span className="mt-0.5 font-mono text-muted-foreground/70 text-sm tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <div className="flex flex-col gap-1 text-left">
                  <span className="font-medium">{chapter.title}</span>

                  {chapter.description && (
                    <span className="line-clamp-2 text-muted-foreground text-sm">
                      {chapter.description}
                    </span>
                  )}
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent className="[&_a]:no-underline">
              <ul className="ml-8 flex flex-col gap-1">
                {chapter.lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <ClientLink
                      className="block rounded-md py-2.5 pl-4 text-muted-foreground text-sm transition-colors hover:bg-muted/50 hover:text-foreground"
                      href={`/b/${brandSlug}/c/${courseSlug}/c/${chapter.slug}/l/${lesson.slug}`}
                    >
                      {lesson.title}
                    </ClientLink>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
