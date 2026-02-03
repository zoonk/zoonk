import { AIWarning } from "@/components/catalog/ai-warning";
import { type ChapterWithDetails } from "@/data/chapters/get-chapter";
import { Link } from "@/i18n/navigation";
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
          <MediaCardIconText>{chapterPosition}</MediaCardIconText>
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
            <MediaCardPopoverSourceLink render={<Link href={`/b/${brandSlug}/c/${courseSlug}`} />}>
              {chapter.course.title}
            </MediaCardPopoverSourceLink>
          </MediaCardPopoverSource>
        </MediaCardPopoverMeta>
      </MediaCardPopover>
    </MediaCard>
  );
}
