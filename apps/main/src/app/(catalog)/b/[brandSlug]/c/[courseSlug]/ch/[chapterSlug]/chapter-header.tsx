import { AIWarning } from "@/components/catalog/ai-warning";
import { type ChapterWithDetails } from "@/data/chapters/get-chapter";
import Link from "next/link";
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
      <MediaCardIcon aria-label={t("Chapter {position}", { position: chapterPosition })} role="img">
        <MediaCardIconText>{chapterPosition}</MediaCardIconText>
      </MediaCardIcon>

      <MediaCardContent>
        <MediaCardBreadcrumb>
          <Link
            className="hover:text-foreground truncate transition-colors"
            href={`/b/${brandSlug}/c/${courseSlug}`}
          >
            {chapter.course.title}
          </Link>
        </MediaCardBreadcrumb>

        <MediaCardTrigger>
          <MediaCardHeader>
            <MediaCardTitle>{chapter.title}</MediaCardTitle>
            <MediaCardIndicator />
          </MediaCardHeader>
          <MediaCardDescription>{chapter.description}</MediaCardDescription>
        </MediaCardTrigger>
      </MediaCardContent>

      <MediaCardPopover>
        <AIWarning brandSlug={brandSlug} />
        <MediaCardPopoverText>{chapter.description}</MediaCardPopoverText>
      </MediaCardPopover>
    </MediaCard>
  );
}
