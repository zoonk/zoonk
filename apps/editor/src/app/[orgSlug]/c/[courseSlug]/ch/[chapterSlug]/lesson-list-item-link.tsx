"use client";

import {
  EditorListItemContent,
  EditorListItemDescription,
  EditorListItemLink,
  EditorListItemTitle,
} from "@/components/editor-list";
import Link from "next/link";

export function LessonListItemLink({
  chapterSlug,
  courseSlug,
  description,
  lessonSlug,
  orgSlug,
  title,
}: {
  chapterSlug: string;
  courseSlug: string;
  description: string | null;
  lessonSlug: string;
  orgSlug: string;
  title: string;
}) {
  return (
    <EditorListItemLink
      render={<Link href={`/${orgSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}`} />}
    >
      <EditorListItemContent>
        <EditorListItemTitle>{title}</EditorListItemTitle>

        {description && <EditorListItemDescription>{description}</EditorListItemDescription>}
      </EditorListItemContent>
    </EditorListItemLink>
  );
}
