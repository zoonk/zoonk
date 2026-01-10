"use client";

import Link from "next/link";
import {
  EditorListItemContent,
  EditorListItemDescription,
  EditorListItemLink,
  EditorListItemTitle,
} from "@/components/editor-list";

export function ChapterListItemLink({
  chapterSlug,
  courseSlug,
  description,
  lang,
  orgSlug,
  title,
}: {
  chapterSlug: string;
  courseSlug: string;
  description: string | null;
  lang: string;
  orgSlug: string;
  title: string;
}) {
  return (
    <EditorListItemLink
      render={
        <Link href={`/${orgSlug}/c/${lang}/${courseSlug}/ch/${chapterSlug}`} />
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
