import { AIWarning } from "@/components/catalog/ai-warning";
import { type LessonWithDetails } from "@/data/lessons/get-lesson";
import { ClientLink } from "@/i18n/client-link";
import {
  MediaCard,
  MediaCardContent,
  MediaCardDescription,
  MediaCardHeader,
  MediaCardIcon,
  MediaCardIconText,
  MediaCardIndicator,
  MediaCardPopover,
  MediaCardPopoverMeta,
  MediaCardPopoverSource,
  MediaCardPopoverSourceLink,
  MediaCardPopoverSourceSeparator,
  MediaCardPopoverText,
  MediaCardTitle,
  MediaCardTrigger,
} from "@zoonk/ui/components/media-card";
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
  const lessonPosition = String(lesson.position + 1).padStart(2, "0");

  return (
    <MediaCard>
      <MediaCardTrigger>
        <MediaCardIcon aria-label={t("Lesson {position}", { position: lessonPosition })} role="img">
          <MediaCardIconText>{lessonPosition}</MediaCardIconText>
        </MediaCardIcon>

        <MediaCardContent>
          <MediaCardHeader>
            <MediaCardTitle>{lesson.title}</MediaCardTitle>
            <MediaCardIndicator />
          </MediaCardHeader>
          <MediaCardDescription>{lesson.description}</MediaCardDescription>
        </MediaCardContent>
      </MediaCardTrigger>

      <MediaCardPopover>
        <AIWarning brandSlug={brandSlug} />

        <MediaCardPopoverText>{lesson.description}</MediaCardPopoverText>

        <MediaCardPopoverMeta>
          <MediaCardPopoverSource>
            <MediaCardPopoverSourceLink
              render={<ClientLink href={`/b/${brandSlug}/c/${courseSlug}`} />}
            >
              {lesson.chapter.course.title}
            </MediaCardPopoverSourceLink>
            <MediaCardPopoverSourceSeparator />
            <MediaCardPopoverSourceLink
              render={<ClientLink href={`/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}`} />}
            >
              {lesson.chapter.title}
            </MediaCardPopoverSourceLink>
          </MediaCardPopoverSource>
        </MediaCardPopoverMeta>
      </MediaCardPopover>
    </MediaCard>
  );
}
