"use client";

import { CatalogListItemProgress } from "@/components/catalog/catalog-list";
import { API_URL } from "@zoonk/utils/constants";
import { isJsonObject } from "@zoonk/utils/json";
import { useExtracted } from "next-intl";
import useSWR from "swr";

type LessonCompletionData = {
  completedActivities: number;
  lessonId: number;
  totalActivities: number;
};

async function fetchChapterCompletion(url: string): Promise<LessonCompletionData[]> {
  const res = await fetch(url, { credentials: "include" });
  const json: unknown = await res.json();

  if (!isJsonObject(json) || !Array.isArray(json.lessons)) {
    return [];
  }

  return json.lessons.filter(
    (lesson): lesson is LessonCompletionData =>
      isJsonObject(lesson) &&
      typeof lesson.lessonId === "number" &&
      typeof lesson.completedActivities === "number" &&
      typeof lesson.totalActivities === "number",
  );
}

export function LessonCompletion({ chapterId, lessonId }: { chapterId: number; lessonId: number }) {
  const t = useExtracted();

  const { data: lessons } = useSWR(
    `${API_URL}/v1/progress/chapter-completion?chapterId=${chapterId}`,
    fetchChapterCompletion,
  );

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
