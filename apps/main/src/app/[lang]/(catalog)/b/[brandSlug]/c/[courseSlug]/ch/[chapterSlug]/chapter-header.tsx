import { AIWarning } from "@/components/catalog/ai-warning";
import { CatalogHeaderImage } from "@/components/catalog/catalog-header-image";
import { getOriginalCourseHref } from "@/data/courses/course-href";
import { Link } from "@/i18n/navigation";
import { getDefaultChapterImage } from "@/lib/catalog/default-images";
import { type ChapterWithDetails } from "@zoonk/core/chapters/get-by-slug";
import {
  MediaCard,
  MediaCardBreadcrumb,
  MediaCardContent,
  MediaCardDescription,
  MediaCardHeader,
  MediaCardIndicator,
  MediaCardPopover,
  MediaCardPopoverText,
  MediaCardTitle,
  MediaCardTrigger,
} from "@zoonk/ui/components/media-card";

export function ChapterHeader({
  brandSlug,
  chapter,
  courseSlug,
  variant,
}: {
  brandSlug: string;
  chapter: ChapterWithDetails;
  courseSlug: string;
  variant?: "default" | "sidebar";
}) {
  const chapterImage =
    chapter.imageUrl ?? getDefaultChapterImage({ categories: chapter.course.categories });

  return (
    <MediaCard variant={variant}>
      <CatalogHeaderImage alt={chapter.title} src={chapterImage} />

      <MediaCardContent>
        <MediaCardBreadcrumb className="hidden sm:block">
          <Link
            className="hover:text-foreground block truncate transition-colors"
            href={getOriginalCourseHref({ brandSlug, courseSlug })}
            prefetch
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
        <MediaCardPopoverText>{chapter.description}</MediaCardPopoverText>
        <AIWarning brandSlug={brandSlug} />
      </MediaCardPopover>
    </MediaCard>
  );
}
