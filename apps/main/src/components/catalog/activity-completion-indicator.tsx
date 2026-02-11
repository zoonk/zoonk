"use client";

import { CatalogListItemIndicator } from "@/components/catalog/catalog-list";
import { API_URL } from "@zoonk/utils/constants";
import { isJsonObject } from "@zoonk/utils/json";
import { useExtracted } from "next-intl";
import useSWR from "swr";

async function fetchCompletedActivities(url: string): Promise<string[]> {
  const res = await fetch(url, { credentials: "include" });
  const json: unknown = await res.json();

  if (!isJsonObject(json) || !Array.isArray(json.completedActivityIds)) {
    return [];
  }

  return json.completedActivityIds.filter((id): id is string => typeof id === "string");
}

export function ActivityCompletionIndicator({
  activityId,
  lessonId,
}: {
  activityId: string;
  lessonId: number;
}) {
  const t = useExtracted();

  const { data: completedIds } = useSWR(
    `${API_URL}/v1/progress/activity-completion?lessonId=${lessonId}`,
    fetchCompletedActivities,
  );

  const completed = completedIds?.includes(activityId) ?? false;

  return (
    <CatalogListItemIndicator
      completed={completed}
      completedLabel={t("Completed")}
      notCompletedLabel={t("Not completed")}
    />
  );
}
