import { type ActivityWithSteps, getActivity } from "@/data/activities/get-activity";
import { getLesson } from "@/data/lessons/get-lesson";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cacheTagActivity } from "@zoonk/utils/cache";
import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { ActivityNotGenerated } from "./activity-not-generated";

async function getCachedActivityData({
  brandSlug,
  chapterSlug,
  courseSlug,
  lessonSlug,
  position,
}: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  lessonSlug: string;
  position: string;
}): Promise<
  | { status: "not-found" }
  | { status: "pending"; activityId: bigint }
  | { status: "completed"; activity: ActivityWithSteps }
> {
  "use cache";

  const lesson = await getLesson({ brandSlug, chapterSlug, courseSlug, lessonSlug });

  if (!lesson) {
    return { status: "not-found" };
  }

  const activityPosition = Number.parseInt(position, 10);

  if (Number.isNaN(activityPosition)) {
    return { status: "not-found" };
  }

  const activity = await getActivity({ lessonId: lesson.id, position: activityPosition });

  if (!activity) {
    return { status: "not-found" };
  }

  cacheTag(cacheTagActivity({ activityId: activity.id }));

  if (activity.generationStatus !== "completed") {
    return { activityId: activity.id, status: "pending" };
  }

  return { activity, status: "completed" };
}

export async function ActivityContent({
  brandSlug,
  chapterSlug,
  courseSlug,
  lessonSlug,
  locale,
  position,
}: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  lessonSlug: string;
  locale: string;
  position: string;
}) {
  const result = await getCachedActivityData({
    brandSlug,
    chapterSlug,
    courseSlug,
    lessonSlug,
    position,
  });

  if (result.status === "not-found") {
    notFound();
  }

  if (result.status === "pending") {
    return <ActivityNotGenerated activityId={result.activityId} locale={locale} />;
  }

  return (
    <pre className="bg-muted overflow-auto rounded-lg p-4 text-sm">
      {JSON.stringify(
        result.activity,
        (_, value: unknown) => (typeof value === "bigint" ? value.toString() : value),
        2,
      )}
    </pre>
  );
}

export function ActivityContentSkeleton() {
  return <Skeleton className="h-64 w-full rounded-xl" />;
}
