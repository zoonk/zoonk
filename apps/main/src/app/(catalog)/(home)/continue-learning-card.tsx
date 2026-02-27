import { type ContinueLearningItem } from "@/data/courses/get-continue-learning";
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
  FeatureCardSubtitle,
  FeatureCardThumbnail,
  FeatureCardThumbnailImage,
  FeatureCardThumbnailPlaceholder,
  FeatureCardTitle,
} from "@zoonk/ui/components/feature";
import { PlayCircleIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";

function getCourseHrefs(item: ContinueLearningItem) {
  const { activity, chapter, course, lesson } = item;

  if (course.organization) {
    const lessonHref =
      `/b/${course.organization.slug}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}` as const;

    return {
      activityHref: `${lessonHref}/a/${activity.position}` as const,
      courseHref: `/b/${course.organization.slug}/c/${course.slug}` as const,
      lessonHref,
    };
  }

  return {
    activityHref: `/p/${course.id}` as const,
    courseHref: `/p/${course.id}` as const,
    lessonHref: `/p/${course.id}` as const,
  };
}

export async function ContinueLearningCard({
  item,
  kindLabels,
  fullWidth,
}: {
  item: ContinueLearningItem;
  kindLabels: Map<string, string>;
  fullWidth?: boolean;
}) {
  const t = await getExtracted();
  const { activity, course, lesson } = item;

  const defaultLabel = t("Activity");
  const activityLabel = activity.title ?? kindLabels.get(activity.kind) ?? defaultLabel;
  const nextLabel = t("Next: {activity}", { activity: activityLabel });

  const { activityHref, courseHref, lessonHref } = getCourseHrefs(item);

  return (
    <FeatureCard
      className={
        fullWidth ? undefined : "w-[85vw] shrink-0 snap-start sm:w-[45vw] 2xl:w-[calc(25%-1rem)]"
      }
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
                <Image alt={course.title} height={96} src={course.imageUrl} width={96} />
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

          <FeatureCardDescription>{lesson.description}</FeatureCardDescription>
        </FeatureCardBody>
      </FeatureCardContent>
    </FeatureCard>
  );
}
