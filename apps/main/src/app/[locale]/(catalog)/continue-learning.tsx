import { ScrollArea, ScrollBar } from "@zoonk/ui/components/scroll-area";
import {
  SectionHeader,
  SectionHeaderContent,
  SectionHeaderIcon,
  SectionHeaderIndicator,
  SectionHeaderLabel,
  SectionTitle,
} from "@zoonk/ui/components/section";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { PlayCircleIcon } from "lucide-react";
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
  item,
  nextLabel,
}: {
  item: ContinueLearningItem;
  nextLabel: string;
}) {
  const { activity, chapter, course, lesson } = item;
  const lessonHref = `/b/${course.organization.slug}/c/${course.slug}/c/${chapter.slug}/l/${lesson.slug}`;
  const activityHref = `${lessonHref}/a/${activity.position}`;
  const courseHref = `/b/${course.organization.slug}/c/${course.slug}`;

  return (
    <article className="group flex w-[85vw] shrink-0 snap-start flex-col gap-2 sm:w-[45vw] 2xl:w-[calc(20%-1rem)]">
      <Link href={activityHref}>
        <SectionHeader>
          <SectionHeaderContent>
            <SectionHeaderIcon>
              <PlayCircleIcon />
            </SectionHeaderIcon>
            <SectionHeaderLabel>{nextLabel}</SectionHeaderLabel>
          </SectionHeaderContent>
          <SectionHeaderIndicator />
        </SectionHeader>
      </Link>

      <div className="flex gap-3">
        {course.imageUrl ? (
          <Image
            alt={course.title}
            className="size-24 shrink-0 rounded-lg object-cover"
            height={96}
            src={course.imageUrl}
            width={96}
          />
        ) : (
          <div className="flex size-24 shrink-0 items-center justify-center rounded-lg bg-muted">
            <PlayCircleIcon
              aria-hidden="true"
              className="size-6 text-muted-foreground/60"
            />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Link
            className="truncate font-semibold text-base text-foreground/90 leading-none underline-offset-2 transition-colors hover:text-foreground hover:underline"
            href={lessonHref}
          >
            {lesson.title}
          </Link>

          <Link
            className="mb-0.5 truncate text-muted-foreground text-sm underline-offset-2 transition-colors hover:text-muted-foreground/80 hover:underline"
            href={courseHref}
          >
            {course.title}
          </Link>

          <p className="line-clamp-3 text-muted-foreground/80 text-xs">
            {lesson.description}
          </p>
        </div>
      </div>
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
    <section className="flex flex-col gap-3 py-4 md:py-6">
      <SectionTitle className="px-4">{t("Continue learning")}</SectionTitle>

      <ScrollArea className="w-full px-4 pb-2">
        <div className="flex snap-x snap-mandatory gap-4">
          {items.map((item) => {
            const { activity, course } = item;
            const activityLabel =
              activity.title ?? kindLabels.get(activity.kind) ?? defaultLabel;
            const nextLabel = t("Next: {activity}", {
              activity: activityLabel,
            });

            return (
              <ContinueLearningCard
                item={item}
                key={course.id}
                nextLabel={nextLabel}
              />
            );
          })}
        </div>

        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </section>
  );
}

export function ContinueLearningSkeleton() {
  return (
    <section className="flex flex-col gap-3 py-4 md:py-6">
      <Skeleton className="mx-4 h-5 w-32" />

      <div className="flex gap-6 overflow-hidden px-4 pb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div className="flex w-72 shrink-0 flex-col gap-2 md:w-80" key={i}>
            <Skeleton className="h-5 w-full" />
            <div className="flex gap-3">
              <Skeleton className="size-16 shrink-0 rounded-lg" />
              <div className="flex flex-1 flex-col gap-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-6 w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
