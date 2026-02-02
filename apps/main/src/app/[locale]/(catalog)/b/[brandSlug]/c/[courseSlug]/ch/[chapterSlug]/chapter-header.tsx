import { AIWarning } from "@/components/catalog/ai-warning";
import { type ChapterWithDetails } from "@/data/chapters/get-chapter";
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

export async function ChapterHeader({
  brandSlug,
  chapter,
  courseSlug,
}: {
  brandSlug: string;
  chapter: ChapterWithDetails;
  courseSlug: string;
}) {
  const t = await getExtracted();
  const chapterPosition = String(chapter.position + 1).padStart(2, "0");

  return (
    <MediaCard>
      <MediaCardTrigger>
        <MediaCardIcon
          aria-label={t("Chapter {position}", { position: chapterPosition })}
          role="img"
        >
          <span className="text-muted-foreground/60 font-mono text-2xl tracking-tight tabular-nums">
            {chapterPosition}
          </span>
        </MediaCardIcon>

        <MediaCardContent>
          <MediaCardHeader>
            <MediaCardTitle>{chapter.title}</MediaCardTitle>
            <MediaCardIndicator />
          </MediaCardHeader>
          <MediaCardDescription>{chapter.description}</MediaCardDescription>
        </MediaCardContent>
      </MediaCardTrigger>

      <MediaCardPopover>
        <AIWarning brandSlug={brandSlug} />

        <MediaCardPopoverText>{chapter.description}</MediaCardPopoverText>

        <MediaCardPopoverMeta>
          <MediaCardPopoverSource>
            <Link
              className="text-muted-foreground hover:text-foreground transition-colors"
              href={`/b/${brandSlug}/c/${courseSlug}`}
            >
              {chapter.course.title}
            </Link>
          </MediaCardPopoverSource>
        </MediaCardPopoverMeta>
      </MediaCardPopover>
    </MediaCard>
  );
}
