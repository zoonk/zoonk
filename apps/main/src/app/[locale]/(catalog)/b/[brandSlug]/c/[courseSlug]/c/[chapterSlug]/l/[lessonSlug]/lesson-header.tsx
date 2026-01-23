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
import { AIWarning } from "@/components/catalog/ai-warning";
import type { LessonWithDetails } from "@/data/lessons/get-lesson";
import { Link } from "@/i18n/navigation";

export async function LessonHeader({
  brandSlug,
  courseSlug,
  lesson,
}: {
  brandSlug: string;
  courseSlug: string;
  lesson: LessonWithDetails;
}) {
  const t = await getExtracted();
  const lessonPosition = String(lesson.position + 1).padStart(2, "0");

  return (
    <MediaCard>
      <MediaCardTrigger>
        <MediaCardIcon
          aria-label={t("Lesson {position}", { position: lessonPosition })}
          role="img"
        >
          <span className="font-mono text-2xl text-muted-foreground/60 tabular-nums tracking-tight">
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
              className="text-muted-foreground transition-colors hover:text-foreground"
              href={`/b/${brandSlug}/c/${courseSlug}`}
            >
              {lesson.chapter.course.title}
            </Link>
            <span className="mx-1.5 text-muted-foreground/40">/</span>
            <span>{lesson.chapter.title}</span>
          </MediaCardPopoverSource>
        </MediaCardPopoverMeta>
      </MediaCardPopover>
    </MediaCard>
  );
}
