"use client";

import Link from "next/link";
import {
  EditorListItemContent,
  EditorListItemDescription,
  EditorListItemLink,
  EditorListItemTitle,
} from "@/components/editor-list";

export function LessonListItemLink({
  chapterSlug,
  courseSlug,
  description,
  lang,
  lessonSlug,
  orgSlug,
  title,
}: {
  chapterSlug: string;
  courseSlug: string;
  description: string | null;
  lang: string;
  lessonSlug: string;
  orgSlug: string;
  title: string;
}) {
  return (
    <EditorListItemLink
      render={
        <Link
          href={`/${orgSlug}/c/${lang}/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}`}
        />
      }
    >
      <EditorListItemContent>
        <EditorListItemTitle>{title}</EditorListItemTitle>

        {description && (
          <EditorListItemDescription>{description}</EditorListItemDescription>
        )}
      </EditorListItemContent>
    </EditorListItemLink>
  );
}
