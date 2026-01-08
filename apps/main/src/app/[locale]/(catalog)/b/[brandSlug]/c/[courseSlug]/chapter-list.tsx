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
            <AccordionTrigger className="px-0 py-4 hover:no-underline">
              <div className="flex gap-4">
                <span className="w-6 shrink-0 font-mono text-muted-foreground/60 text-sm tabular-nums leading-7">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <div className="flex min-w-0 flex-col gap-0.5 text-left">
                  <span className="font-medium leading-7">{chapter.title}</span>

                  {chapter.description && (
                    <span className="line-clamp-2 text-muted-foreground text-sm leading-relaxed">
                      {chapter.description}
                    </span>
                  )}
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent className="[&_a]:no-underline">
              <ul className="ml-10 flex flex-col">
                {chapter.lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <ClientLink
                      className="-ml-2 block rounded-md px-2 py-2 text-muted-foreground text-sm transition-colors hover:bg-muted/50 hover:text-foreground"
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
