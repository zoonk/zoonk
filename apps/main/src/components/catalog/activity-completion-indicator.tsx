"use client";

import { CatalogListItemIndicator } from "@/components/catalog/catalog-list";
import { buildActivityCompletionKey, fetchCompletedActivities } from "@/lib/progress-fetchers";
import { useExtracted } from "next-intl";
import useSWR from "swr";

export function ActivityCompletionIndicator({
  activityId,
  lessonId,
}: {
  activityId: string;
  lessonId: number;
}) {
  const t = useExtracted();

  const { data: completedIds } = useSWR(
    buildActivityCompletionKey(lessonId),
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
