import { AIWarning } from "@/components/catalog/ai-warning";
import { type LessonWithDetails } from "@/data/lessons/get-lesson";
import { Link } from "@/i18n/navigation";
import {
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@zoonk/ui/components/breadcrumb";
import {
  MediaCard,
  MediaCardBreadcrumb,
  MediaCardContent,
  MediaCardDescription,
  MediaCardHeader,
  MediaCardIcon,
  MediaCardIconText,
  MediaCardIndicator,
  MediaCardPopover,
  MediaCardPopoverText,
  MediaCardTitle,
  MediaCardTrigger,
} from "@zoonk/ui/components/media-card";
import { formatPosition } from "@zoonk/utils/string";
import { getExtracted } from "next-intl/server";

export async function LessonHeader({
  brandSlug,
  chapterSlug,
  courseSlug,
  lesson,
}: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  lesson: LessonWithDetails;
}) {
  const t = await getExtracted();
  const lessonPosition = formatPosition(lesson.position);

  return (
    <MediaCard>
      <MediaCardIcon aria-label={t("Lesson {position}", { position: lessonPosition })} role="img">
        <MediaCardIconText>{lessonPosition}</MediaCardIconText>
      </MediaCardIcon>

      <MediaCardContent>
        <MediaCardBreadcrumb>
          <BreadcrumbList className="text-xs">
            <BreadcrumbItem>
              <Link
                className="hover:text-foreground transition-colors"
                href={`/b/${brandSlug}/c/${courseSlug}`}
              >
                {lesson.chapter.course.title}
              </Link>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <Link
                className="hover:text-foreground transition-colors"
                href={`/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}`}
              >
                {lesson.chapter.title}
              </Link>
            </BreadcrumbItem>
          </BreadcrumbList>
        </MediaCardBreadcrumb>

        <MediaCardTrigger>
          <MediaCardHeader>
            <MediaCardTitle>{lesson.title}</MediaCardTitle>
            <MediaCardIndicator />
          </MediaCardHeader>
          <MediaCardDescription>{lesson.description}</MediaCardDescription>
        </MediaCardTrigger>
      </MediaCardContent>

      <MediaCardPopover>
        <AIWarning brandSlug={brandSlug} />
        <MediaCardPopoverText>{lesson.description}</MediaCardPopoverText>
      </MediaCardPopover>
    </MediaCard>
  );
}
