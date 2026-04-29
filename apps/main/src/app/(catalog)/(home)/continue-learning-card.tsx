import { type ContinueLearningItem } from "@/data/courses/get-continue-learning";
import { getLessonDisplayMeta } from "@/lib/lessons";
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

async function getHeaderLabel({
  item,
  lessonTitle,
}: {
  item: ContinueLearningItem;
  lessonTitle: string | null;
}) {
  const t = await getExtracted();

  if (item.status === "pending") {
    return t("Continue");
  }

  return t("Next: {lesson}", { lesson: lessonTitle ?? t("Lesson") });
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

export async function ContinueLearningCard({ item }: { item: ContinueLearningItem }) {
  const { course, lesson } = item;
  const lessonMeta = lesson ? await getLessonDisplayMeta(lesson) : null;
  const headerLabel = await getHeaderLabel({ item, lessonTitle: lessonMeta?.title ?? null });
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
                  {lessonMeta?.title}
                </Link>
              </FeatureCardTitle>

              <FeatureCardSubtitle>
                <Link href={courseHref} prefetch>
                  {course.title}
                </Link>
              </FeatureCardSubtitle>

              <FeatureCardDescription>{lessonMeta?.description}</FeatureCardDescription>
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
