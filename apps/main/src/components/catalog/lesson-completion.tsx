"use client";

import { CatalogListItemProgress } from "@/components/catalog/catalog-list";
import { buildChapterCompletionKey, fetchChapterCompletion } from "@/lib/progress-fetchers";
import { useExtracted } from "next-intl";
import useSWR from "swr";

export function LessonCompletion({ chapterId, lessonId }: { chapterId: number; lessonId: number }) {
  const t = useExtracted();

  const { data: lessons } = useSWR(buildChapterCompletionKey(chapterId), fetchChapterCompletion);

  const lesson = lessons?.find((item) => item.lessonId === lessonId);

  if (!lesson) {
    return null;
  }

  return (
    <CatalogListItemProgress
      completed={lesson.completedActivities}
      completedLabel={t("Completed")}
      total={lesson.totalActivities}
    />
  );
}
