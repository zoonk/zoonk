"use client";

import { CatalogListItemProgress } from "@/components/catalog/catalog-list";
import { API_URL } from "@zoonk/utils/constants";
import { isJsonObject } from "@zoonk/utils/json";
import { useExtracted } from "next-intl";
import useSWR from "swr";

type ChapterCompletionData = {
  chapterId: number;
  completedLessons: number;
  totalLessons: number;
};

async function fetchCourseCompletion(url: string): Promise<ChapterCompletionData[]> {
  const res = await fetch(url, { credentials: "include" });
  const json: unknown = await res.json();

  if (!isJsonObject(json) || !Array.isArray(json.chapters)) {
    return [];
  }

  return json.chapters.filter(
    (item): item is ChapterCompletionData =>
      isJsonObject(item) &&
      typeof item.chapterId === "number" &&
      typeof item.completedLessons === "number" &&
      typeof item.totalLessons === "number",
  );
}

export function ChapterCompletion({
  chapterId,
  courseId,
}: {
  chapterId: number;
  courseId: number;
}) {
  const t = useExtracted();

  const { data: chapters } = useSWR(
    `${API_URL}/v1/progress/course-completion?courseId=${courseId}`,
    fetchCourseCompletion,
  );

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
