"use client";

import { CatalogListItemProgress } from "@/components/catalog/catalog-list";
import { buildCourseCompletionKey, fetchCourseCompletion } from "@/lib/progress-fetchers";
import { useExtracted } from "next-intl";
import useSWR from "swr";

export function ChapterCompletion({
  chapterId,
  courseId,
}: {
  chapterId: number;
  courseId: number;
}) {
  const t = useExtracted();

  const { data: chapters } = useSWR(buildCourseCompletionKey(courseId), fetchCourseCompletion);

  const chapter = chapters?.find((item) => item.chapterId === chapterId);

  if (!chapter) {
    return null;
  }

  return (
    <CatalogListItemProgress
      completed={chapter.completedLessons}
      completedLabel={t("Completed")}
      total={chapter.totalLessons}
    />
  );
}
