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

async function getHeaderLabel(item: ContinueLearningItem, kindLabels: Map<string, string>) {
  const t = await getExtracted();

  if (item.status === "pending") {
    return t("Continue");
  }

  const defaultLabel = t("Lesson");
  const lessonLabel = item.lesson.title ?? kindLabels.get(item.lesson.kind) ?? defaultLabel;

  return t("Next: {lesson}", { lesson: lessonLabel });
}

function getHrefs(item: ContinueLearningItem) {
  const { chapter, course, lesson } = item;

  if (!course.organization) {
    const href = `/p/${course.id}` as const;
    return { courseHref: href, headerHref: href, lessonHref: href, prefetch: false };
  }

  const courseHref = `/b/${course.organization.slug}/c/${course.slug}` as const;

  const lessonHref = lesson
    ? (`/b/${course.organization.slug}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}` as const)
    : (`/b/${course.organization.slug}/c/${course.slug}/ch/${chapter.slug}` as const);

  if (item.status === "completed") {
    return {
      courseHref,
      headerHref: lessonHref,
      lessonHref,
      prefetch: true,
    };
  }

  return { courseHref, headerHref: lessonHref, lessonHref, prefetch: false };
}

export async function ContinueLearningCard({
  item,
  kindLabels,
}: {
  item: ContinueLearningItem;
  kindLabels: Map<string, string>;
}) {
  const { course, lesson } = item;
  const headerLabel = await getHeaderLabel(item, kindLabels);
  const { courseHref, headerHref, lessonHref, prefetch } = getHrefs(item);

  return (
    <FeatureCard>
      <Link href={headerHref} prefetch={prefetch}>
        <FeatureCardHeader>
          <FeatureCardHeaderContent>
            <FeatureCardIcon>
              <PlayCircleIcon />
            </FeatureCardIcon>
            <FeatureCardLabel>{headerLabel}</FeatureCardLabel>
          </FeatureCardHeaderContent>
          <FeatureCardIndicator />
        </FeatureCardHeader>
      </Link>

      <FeatureCardContent>
        <Link href={headerHref} prefetch={prefetch}>
          <FeatureCardThumbnail size="lg">
            {course.imageUrl ? (
              <FeatureCardThumbnailImage>
                <Image
                  alt={course.title}
                  height={96}
                  loading="eager"
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
          {lesson ? (
            <>
              <FeatureCardTitle>
                <Link href={lessonHref} prefetch={prefetch}>
                  {lesson.title}
                </Link>
              </FeatureCardTitle>

              <FeatureCardSubtitle>
                <Link href={courseHref} prefetch>
                  {course.title}
                </Link>
              </FeatureCardSubtitle>

              <FeatureCardDescription>{lesson.description}</FeatureCardDescription>
            </>
          ) : (
            <FeatureCardTitle>
              <Link href={courseHref} prefetch>
                {course.title}
              </Link>
            </FeatureCardTitle>
          )}
        </FeatureCardBody>
      </FeatureCardContent>
    </FeatureCard>
  );
}
