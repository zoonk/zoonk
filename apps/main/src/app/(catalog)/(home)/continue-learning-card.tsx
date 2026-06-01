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

async function getHeaderLabel({ lessonTitle }: { lessonTitle: string | null }) {
  const t = await getExtracted();

  if (lessonTitle) {
    return t("Next: {lesson}", { lesson: lessonTitle });
  }

  return t("Continue");
}

function getHrefs(item: ContinueLearningItem) {
  const { chapter, course, lesson } = item;

  if (!course.organization) {
    const href = `/p/${course.id}` as const;

    return { chapterHref: href, courseHref: href, headerHref: href, prefetch: false };
  }

  const courseHref = `/b/${course.organization.slug}/c/${course.slug}` as const;
  const chapterHref = `/b/${course.organization.slug}/c/${course.slug}/ch/${chapter.slug}` as const;

  const lessonHref = lesson
    ? (`/b/${course.organization.slug}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}` as const)
    : chapterHref;

  if (item.status === "completed") {
    return { chapterHref, courseHref, headerHref: lessonHref, prefetch: true };
  }

  return { chapterHref, courseHref, headerHref: lessonHref, prefetch: false };
}

export async function ContinueLearningCard({ item }: { item: ContinueLearningItem }) {
  const { chapter, course, lesson } = item;
  const lessonMeta = lesson ? await getLessonDisplayMeta(lesson) : null;
  const headerLabel = await getHeaderLabel({ lessonTitle: lessonMeta?.title ?? null });
  const { chapterHref, courseHref, headerHref, prefetch } = getHrefs(item);

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
          <FeatureCardTitle>
            <Link href={chapterHref} prefetch={prefetch}>
              {chapter.title}
            </Link>
          </FeatureCardTitle>

          <FeatureCardSubtitle>
            <Link href={courseHref} prefetch>
              {course.title}
            </Link>
          </FeatureCardSubtitle>

          {lessonMeta ? (
            <Link
              className="focus-visible:ring-ring block rounded-sm focus-visible:ring-2 focus-visible:outline-none"
              href={headerHref}
              prefetch={prefetch}
            >
              <FeatureCardDescription className="hover:text-muted-foreground transition-colors hover:underline">
                {lessonMeta.description}
              </FeatureCardDescription>
            </Link>
          ) : null}
        </FeatureCardBody>
      </FeatureCardContent>
    </FeatureCard>
  );
}
