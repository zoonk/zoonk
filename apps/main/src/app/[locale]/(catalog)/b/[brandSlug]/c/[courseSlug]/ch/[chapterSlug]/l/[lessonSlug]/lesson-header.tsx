import { AIWarning } from "@/components/catalog/ai-warning";
import { type LessonWithDetails } from "@/data/lessons/get-lesson";
import { Link } from "@/i18n/navigation";
import {
  MediaCard,
  MediaCardContent,
  MediaCardDescription,
  MediaCardHeader,
  MediaCardIcon,
  MediaCardIndicator,
  MediaCardPopover,
  MediaCardPopoverMeta,
  MediaCardPopoverSource,
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
          <span className="text-muted-foreground/60 font-mono text-2xl tracking-tight tabular-nums">
            {lessonPosition}
          </span>
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
            <Link
              className="text-muted-foreground hover:text-foreground transition-colors"
              href={`/b/${brandSlug}/c/${courseSlug}`}
            >
              {lesson.chapter.course.title}
            </Link>
            <span className="text-muted-foreground/40 mx-1.5">/</span>
            <Link
              className="text-muted-foreground hover:text-foreground transition-colors"
              href={`/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}`}
            >
              {lesson.chapter.title}
            </Link>
          </MediaCardPopoverSource>
        </MediaCardPopoverMeta>
      </MediaCardPopover>
    </MediaCard>
  );
}
