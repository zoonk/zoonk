"use client";

import {
  EditorListItemContent,
  EditorListItemDescription,
  EditorListItemLink,
  EditorListItemTitle,
} from "@/components/editor-list";
import Link from "next/link";

export function ActivityListItemLink({
  activityId,
  chapterSlug,
  courseSlug,
  description,
  kind,
  lang,
  lessonSlug,
  orgSlug,
  title,
}: {
  activityId: bigint;
  chapterSlug: string;
  courseSlug: string;
  description: string | null;
  kind: string;
  lang: string;
  lessonSlug: string;
  orgSlug: string;
  title: string | null;
}) {
  const displayTitle = title ?? kind;

  return (
    <EditorListItemLink
      render={
        <Link
          href={`/${orgSlug}/c/${lang}/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}/a/${activityId}`}
        />
      }
    >
      <EditorListItemContent>
        <EditorListItemTitle>{displayTitle}</EditorListItemTitle>

        {description && <EditorListItemDescription>{description}</EditorListItemDescription>}
      </EditorListItemContent>
    </EditorListItemLink>
  );
}
