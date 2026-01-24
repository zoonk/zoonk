"use client";

import { ClientLink } from "@/i18n/client-link";

type ChapterLessonListProps = {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  lessons: { id: number; slug: string; title: string }[];
};

export function ChapterLessonList({
  brandSlug,
  chapterSlug,
  courseSlug,
  lessons,
}: ChapterLessonListProps) {
  return (
    <ul className="flex flex-col">
      {lessons.map((lesson) => (
        <li key={lesson.id}>
          <ClientLink
            className="text-foreground/80 hover:bg-muted/40 hover:text-foreground -mx-2 block rounded-md px-2 py-2.5 text-sm transition-colors"
            href={`/b/${brandSlug}/c/${courseSlug}/c/${chapterSlug}/l/${lesson.slug}`}
          >
            {lesson.title}
          </ClientLink>
        </li>
      ))}
    </ul>
  );
}
