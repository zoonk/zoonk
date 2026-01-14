"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@zoonk/ui/components/accordion";
import { buttonVariants } from "@zoonk/ui/components/button";
import { SparklesIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import type { ChapterWithLessons } from "@/data/chapters/list-course-chapters";
import { ClientLink } from "@/i18n/client-link";
import { Link } from "@/i18n/navigation";

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
  const t = useExtracted();

  if (chapters.length === 0) {
    if (!emptyStateText) {
      return null;
    }
    return (
      <p className="py-8 text-center text-muted-foreground text-sm">
        {emptyStateText}
      </p>
    );
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
                <span className="w-5 shrink-0 font-mono text-muted-foreground/40 tabular-nums leading-snug sm:w-6">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span className="text-left font-medium leading-snug">
                  {chapter.title}
                </span>
              </div>
            </AccordionTrigger>

            <AccordionContent className="pb-2 [&_a]:no-underline">
              <div className="ml-4 flex flex-col gap-3 sm:ml-6">
                {chapter.description && (
                  <p className="max-w-prose text-muted-foreground text-sm leading-relaxed">
                    {chapter.description}
                  </p>
                )}

                {chapter.lessons.length === 0 ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-muted-foreground text-sm">
                      {t(
                        "Lessons haven't been generated for this chapter yet.",
                      )}
                    </p>
                    <Link
                      className={buttonVariants({
                        className: "w-fit",
                        size: "sm",
                        variant: "outline",
                      })}
                      href={`/generate/ch/${chapter.id}`}
                      prefetch={false}
                    >
                      <SparklesIcon className="size-4" />
                      {t("Generate lessons")}
                    </Link>
                  </div>
                ) : (
                  <ul className="flex flex-col">
                    {chapter.lessons.map((lesson) => (
                      <li key={lesson.id}>
                        <ClientLink
                          className="-mx-2 block rounded-md px-2 py-2.5 text-foreground/80 text-sm transition-colors hover:bg-muted/40 hover:text-foreground"
                          href={`/b/${brandSlug}/c/${courseSlug}/c/${chapter.slug}/l/${lesson.slug}`}
                        >
                          {lesson.title}
                        </ClientLink>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
