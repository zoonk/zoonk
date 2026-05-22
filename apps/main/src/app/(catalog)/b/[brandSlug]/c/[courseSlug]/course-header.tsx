import { AIWarning } from "@/components/catalog/ai-warning";
import { CatalogHeaderImage } from "@/components/catalog/catalog-header-image";
import { type CourseWithDetails } from "@/data/courses/get-course";
import { getCategories } from "@/lib/categories/category";
import { Badge } from "@zoonk/ui/components/badge";
import {
  MediaCard,
  MediaCardContent,
  MediaCardDescription,
  MediaCardHeader,
  MediaCardIcon,
  MediaCardIndicator,
  MediaCardPopover,
  MediaCardPopoverBadges,
  MediaCardPopoverMeta,
  MediaCardPopoverSource,
  MediaCardPopoverSourceLink,
  MediaCardPopoverText,
  MediaCardTitle,
  MediaCardTrigger,
} from "@zoonk/ui/components/media-card";
import { NotebookPenIcon } from "lucide-react";
import Link from "next/link";

export async function CourseHeader({
  brandSlug,
  course,
  variant,
}: {
  brandSlug: string;
  course: CourseWithDetails;
  variant?: "default" | "sidebar";
}) {
  const categoryLabels = await getCategories();
  const courseCategoryKeys = new Set(course.categories.map((item) => item.category));

  const displayCategories = categoryLabels.filter((cat) => courseCategoryKeys.has(cat.key));

  return (
    <MediaCard variant={variant}>
      {course.imageUrl ? (
        <CatalogHeaderImage alt={course.title} src={course.imageUrl} />
      ) : (
        <MediaCardIcon aria-label={course.title} role="img">
          <NotebookPenIcon aria-hidden="true" className="text-muted-foreground/80 size-8" />
        </MediaCardIcon>
      )}

      <MediaCardContent>
        <MediaCardTrigger>
          <MediaCardHeader>
            <MediaCardTitle>{course.title}</MediaCardTitle>
            <MediaCardIndicator />
          </MediaCardHeader>
          <MediaCardDescription>{course.description}</MediaCardDescription>
        </MediaCardTrigger>
      </MediaCardContent>

      <MediaCardPopover>
        <MediaCardPopoverText>{course.description}</MediaCardPopoverText>

        <MediaCardPopoverMeta>
          <MediaCardPopoverSource>
            <MediaCardPopoverSourceLink render={<span />}>
              {course.organization?.name}
            </MediaCardPopoverSourceLink>
          </MediaCardPopoverSource>

          {displayCategories.length > 0 && (
            <MediaCardPopoverBadges>
              {displayCategories.map((cat) => (
                <Badge
                  key={cat.key}
                  render={<Link href={`/courses/${cat.key}`} />}
                  variant="outline"
                >
                  {cat.label}
                </Badge>
              ))}
            </MediaCardPopoverBadges>
          )}
        </MediaCardPopoverMeta>

        <AIWarning brandSlug={brandSlug} />
      </MediaCardPopover>
    </MediaCard>
  );
}
