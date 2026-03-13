import { CatalogListItemIndicator } from "@/components/catalog/catalog-list";
import { getActivityIcon, getActivityKinds } from "@/lib/activities";
import { getActivityProgress } from "@zoonk/core/progress/activities";
import { type Activity } from "@zoonk/db";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";
import Link from "next/link";

export async function ActivityPath({
  activities,
  brandSlug,
  chapterSlug,
  courseSlug,
  lessonId,
  lessonSlug,
}: {
  activities: Activity[];
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  lessonId: number;
  lessonSlug: string;
}) {
  if (activities.length === 0) {
    return null;
  }

  const t = await getExtracted();
  const [activityKinds, completedIds] = await Promise.all([
    getActivityKinds(),
    getActivityProgress({ lessonId }),
  ]);

  const kindMeta = new Map(activityKinds.map((kind) => [kind.key, kind]));

  return (
    <ul aria-label={t("Activities")} className="flex flex-col" role="list">
      {activities.map((activity, index) => {
        const meta = kindMeta.get(activity.kind);
        const Icon = getActivityIcon(activity.kind);
        const completed = completedIds.includes(String(activity.id));
        const isLast = index === activities.length - 1;
        const title = activity.title ?? meta?.label;

        return (
          <li key={String(activity.id)}>
            <Link
              className="hover:bg-muted/30 -mx-3 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors"
              href={`/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}/a/${activity.position}`}
              prefetch={activity.generationStatus === "completed"}
            >
              <div className="relative flex flex-col items-center self-stretch">
                <div className="text-muted-foreground/50 flex size-6 shrink-0 items-center justify-center">
                  <Icon aria-hidden="true" className="size-4" />
                </div>

                {!isLast && (
                  <div
                    className="bg-border/30 absolute top-6 w-px flex-1 self-center"
                    style={{ bottom: "-10px" }}
                  />
                )}
              </div>

              <span className="text-foreground/90 min-w-0 flex-1 text-sm leading-snug font-medium">
                {title}
              </span>

              <CatalogListItemIndicator
                completed={completed}
                completedLabel={t("Completed")}
                notCompletedLabel={t("Not completed")}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function ActivityPathSkeleton({ count }: { count: number }) {
  return (
    <ul className="flex flex-col">
      {Array.from({ length: count }).map((_, i) => (
        // oxlint-disable-next-line eslint/no-array-index-key -- static skeleton
        <li className="-mx-3 flex items-center gap-3 px-3 py-2.5" key={i}>
          <div className="relative flex flex-col items-center self-stretch">
            <Skeleton className="size-6 shrink-0 rounded" />
            {i < count - 1 && (
              <div
                className="bg-border/30 absolute top-6 w-px flex-1 self-center"
                style={{ bottom: "-10px" }}
              />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Skeleton className="h-4 w-2/5" />
          </div>
          <Skeleton className="size-3.5 shrink-0 rounded-full" />
        </li>
      ))}
    </ul>
  );
}
