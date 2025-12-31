import { Skeleton } from "@zoonk/ui/components/skeleton";
import { ChevronRightIcon, PlayCircleIcon } from "lucide-react";
import { cacheLife } from "next/cache";
import Image from "next/image";
import { getExtracted } from "next-intl/server";
import {
  type ContinueLearningItem,
  getContinueLearning,
} from "@/data/courses/get-continue-learning";
import { Link } from "@/i18n/navigation";
import { getActivityKinds } from "@/lib/activities";
import { Hero } from "./hero";

function ContinueLearningCard({
  activityHref,
  courseHref,
  course,
  lesson,
  lessonHref,
  nextLabel,
}: {
  activityHref: string;
  lessonHref: string;
  courseHref: string;
  course: ContinueLearningItem["course"];
  lesson: ContinueLearningItem["lesson"];
  nextLabel: string;
}) {
  return (
    <article className="group flex w-72 shrink-0 snap-start flex-col gap-3 md:w-80">
      <Link
        className="flex items-center gap-2 font-medium text-primary text-sm transition-colors hover:text-primary/80"
        href={activityHref}
      >
        <PlayCircleIcon aria-hidden="true" className="size-4" />
        <span className="truncate">{nextLabel}</span>
        <ChevronRightIcon aria-hidden="true" className="size-3 opacity-60" />
      </Link>

      <div className="flex gap-3">
        {course.imageUrl ? (
          <Image
            alt={course.title}
            className="size-16 shrink-0 rounded-lg object-cover"
            height={64}
            src={course.imageUrl}
            width={64}
          />
        ) : (
          <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted">
            <PlayCircleIcon
              aria-hidden="true"
              className="size-6 text-muted-foreground/60"
            />
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-1">
          <Link
            className="truncate font-medium text-foreground/90 transition-colors hover:text-foreground"
            href={lessonHref}
          >
            {lesson.title}
          </Link>

          <Link
            className="truncate text-muted-foreground text-sm transition-colors hover:text-muted-foreground/80"
            href={courseHref}
          >
            {course.title}
          </Link>
        </div>
      </div>

      <p className="line-clamp-2 text-muted-foreground text-sm leading-relaxed">
        {lesson.description}
      </p>
    </article>
  );
}

export async function ContinueLearning() {
  "use cache: private";
  cacheLife("minutes");

  const t = await getExtracted();
  const activityKinds = await getActivityKinds();
  const items = await getContinueLearning();

  if (items.length === 0) {
    return <Hero />;
  }

  const kindLabels = new Map<string, string>(
    activityKinds.map((k) => [k.key, k.label]),
  );
  const defaultLabel = t("Activity");

  return (
    <section className="flex flex-col gap-4 px-4 py-8 md:py-12">
      <h2 className="font-semibold text-foreground/90 text-lg tracking-tight">
        {t("Continue learning")}
      </h2>

      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:gap-8 md:overflow-visible md:px-0 lg:grid-cols-3 xl:grid-cols-5">
        {items.map((item) => {
          const { activity, chapter, course, lesson } = item;
          const activityLabel =
            activity.title ?? kindLabels.get(activity.kind) ?? defaultLabel;
          const lessonHref = `/b/${course.organization.slug}/c/${course.slug}/c/${chapter.slug}/l/${lesson.slug}`;
          const activityHref = `${lessonHref}/a/${activity.position}`;
          const courseHref = `/b/${course.organization.slug}/c/${course.slug}`;
          const nextLabel = t("Next: {activity}", { activity: activityLabel });

          return (
            <ContinueLearningCard
              activityHref={activityHref}
              course={course}
              courseHref={courseHref}
              key={course.id}
              lesson={lesson}
              lessonHref={lessonHref}
              nextLabel={nextLabel}
            />
          );
        })}
      </div>
    </section>
  );
}

export function ContinueLearningSkeleton() {
  return (
    <section className="flex flex-col gap-4 px-4 py-8 md:py-12">
      <Skeleton className="h-6 w-40" />

      <div className="no-scrollbar -mx-4 flex gap-6 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:gap-8 md:overflow-visible md:px-0 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div className="flex w-72 shrink-0 flex-col gap-3 md:w-80" key={i}>
            <Skeleton className="h-5 w-32" />
            <div className="flex gap-3">
              <Skeleton className="size-16 shrink-0 rounded-lg" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}
