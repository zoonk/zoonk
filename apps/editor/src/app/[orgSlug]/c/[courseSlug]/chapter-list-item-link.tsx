"use client";

import {
  EditorListItemContent,
  EditorListItemDescription,
  EditorListItemLink,
  EditorListItemTitle,
} from "@/components/editor-list";
import Link from "next/link";

export function ChapterListItemLink({
  chapterSlug,
  courseSlug,
  description,
  orgSlug,
  title,
}: {
  chapterSlug: string;
  courseSlug: string;
  description: string | null;
  orgSlug: string;
  title: string;
}) {
  return (
    <EditorListItemLink render={<Link href={`/${orgSlug}/c/${courseSlug}/ch/${chapterSlug}`} />}>
      <EditorListItemContent>
        <EditorListItemTitle>{title}</EditorListItemTitle>

        {description && <EditorListItemDescription>{description}</EditorListItemDescription>}
      </EditorListItemContent>
    </EditorListItemLink>
  );
}
