import { AIWarning } from "@/components/catalog/ai-warning";
import { type ChapterWithDetails } from "@/data/chapters/get-chapter";
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
  MediaCardPopoverText,
  MediaCardTitle,
  MediaCardTrigger,
} from "@zoonk/ui/components/media-card";
import { formatPosition } from "@zoonk/utils/string";
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
  const chapterPosition = formatPosition(chapter.position);

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
            <MediaCardPopoverSourceLink
              render={<ClientLink href={`/b/${brandSlug}/c/${courseSlug}`} />}
            >
              {chapter.course.title}
            </MediaCardPopoverSourceLink>
          </MediaCardPopoverSource>
        </MediaCardPopoverMeta>
      </MediaCardPopover>
    </MediaCard>
  );
}
