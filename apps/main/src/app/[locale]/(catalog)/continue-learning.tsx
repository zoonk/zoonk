import {
  FeatureCard,
  FeatureCardBody,
  FeatureCardContent,
  FeatureCardDescription,
  FeatureCardHeader,
  FeatureCardHeaderContent,
  FeatureCardIcon,
  FeatureCardIndicator,
  FeatureCardLabel,
  FeatureCardSectionTitle,
  FeatureCardSubtitle,
  FeatureCardThumbnail,
  FeatureCardThumbnailImage,
  FeatureCardThumbnailPlaceholder,
  FeatureCardTitle,
} from "@zoonk/ui/components/feature";
import { ScrollArea, ScrollBar } from "@zoonk/ui/components/scroll-area";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { PlayCircleIcon } from "lucide-react";
import { cacheLife } from "next/cache";
import Image from "next/image";
import { getExtracted } from "next-intl/server";
import { getContinueLearning } from "@/data/courses/get-continue-learning";
import { Link } from "@/i18n/navigation";
import { getActivityKinds } from "@/lib/activities";
import { Hero } from "./hero";

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
      <FeatureCardSectionTitle className="px-4">
        {t("Continue learning")}
      </FeatureCardSectionTitle>

      <ScrollArea className="w-full px-4 pb-2">
        <div className="flex snap-x snap-mandatory gap-4">
          {items.map((item) => {
            const { activity, chapter, course, lesson } = item;

            const activityLabel =
              activity.title ?? kindLabels.get(activity.kind) ?? defaultLabel;

            const nextLabel = t("Next: {activity}", {
              activity: activityLabel,
            });

            const lessonHref = `/b/${course.organization.slug}/c/${course.slug}/c/${chapter.slug}/l/${lesson.slug}`;
            const activityHref = `${lessonHref}/a/${activity.position}`;
            const courseHref = `/b/${course.organization.slug}/c/${course.slug}`;

            return (
              <FeatureCard
                className="w-[85vw] shrink-0 snap-start sm:w-[45vw] 2xl:w-[calc(25%-1rem)]"
                key={activity.id}
              >
                <Link href={activityHref}>
                  <FeatureCardHeader>
                    <FeatureCardHeaderContent>
                      <FeatureCardIcon>
                        <PlayCircleIcon />
                      </FeatureCardIcon>
                      <FeatureCardLabel>{nextLabel}</FeatureCardLabel>
                    </FeatureCardHeaderContent>
                    <FeatureCardIndicator />
                  </FeatureCardHeader>
                </Link>

                <FeatureCardContent>
                  <Link href={activityHref}>
                    <FeatureCardThumbnail size="lg">
                      {course.imageUrl ? (
                        <FeatureCardThumbnailImage>
                          <Image
                            alt={course.title}
                            height={96}
                            src={course.imageUrl}
                            width={96}
                          />
                        </FeatureCardThumbnailImage>
                      ) : (
                        <FeatureCardThumbnailPlaceholder>
                          <PlayCircleIcon aria-hidden="true" />
                        </FeatureCardThumbnailPlaceholder>
                      )}
                    </FeatureCardThumbnail>
                  </Link>

                  <FeatureCardBody>
                    <FeatureCardTitle>
                      <Link href={lessonHref}>{lesson.title}</Link>
                    </FeatureCardTitle>

                    <FeatureCardSubtitle>
                      <Link href={courseHref}>{course.title}</Link>
                    </FeatureCardSubtitle>

                    <FeatureCardDescription>
                      {lesson.description}
                    </FeatureCardDescription>
                  </FeatureCardBody>
                </FeatureCardContent>
              </FeatureCard>
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
          <FeatureCard className="w-72 shrink-0 md:w-80" key={i}>
            <Skeleton className="h-5 w-full" />

            <FeatureCardContent>
              <FeatureCardThumbnail size="lg">
                <Skeleton className="size-full" />
              </FeatureCardThumbnail>

              <FeatureCardBody className="gap-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-6 w-full" />
              </FeatureCardBody>
            </FeatureCardContent>
          </FeatureCard>
        ))}
      </div>
    </section>
  );
}
