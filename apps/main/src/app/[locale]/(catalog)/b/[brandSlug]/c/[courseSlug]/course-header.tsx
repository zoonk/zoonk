import { Badge } from "@zoonk/ui/components/badge";
import {
  MediaCard,
  MediaCardContent,
  MediaCardDescription,
  MediaCardHeader,
  MediaCardIcon,
  MediaCardImage,
  MediaCardIndicator,
  MediaCardPopover,
  MediaCardPopoverBadges,
  MediaCardPopoverMeta,
  MediaCardPopoverSource,
  MediaCardPopoverText,
  MediaCardTitle,
  MediaCardTrigger,
} from "@zoonk/ui/components/media-card";
import { NotebookPenIcon } from "lucide-react";
import Image from "next/image";
import { getLocale } from "next-intl/server";
import { AIWarning } from "@/components/catalog/ai-warning";
import type { CourseWithDetails } from "@/data/courses/get-course";
import { Link } from "@/i18n/navigation";
import { getCategories } from "@/lib/categories/category-server";

export async function CourseHeader({
  brandSlug,
  course,
}: {
  brandSlug: string;
  course: CourseWithDetails;
}) {
  const locale = await getLocale();
  const categoryLabels = await getCategories({ locale });
  const courseCategoryKeys = course.categories.map((c) => c.category);

  const displayCategories = categoryLabels.filter((cat) =>
    courseCategoryKeys.includes(cat.key),
  );

  return (
    <MediaCard>
      <MediaCardTrigger>
        {course.imageUrl ? (
          <MediaCardImage>
            <Image
              alt={course.title}
              className="size-full object-cover"
              fill
              sizes="(max-width: 640px) 80px, 96px"
              src={course.imageUrl}
            />
          </MediaCardImage>
        ) : (
          <MediaCardIcon aria-label={course.title} role="img">
            <NotebookPenIcon
              aria-hidden="true"
              className="size-8 text-muted-foreground/80"
            />
          </MediaCardIcon>
        )}

        <MediaCardContent>
          <MediaCardHeader>
            <MediaCardTitle>{course.title}</MediaCardTitle>
            <MediaCardIndicator />
          </MediaCardHeader>
          <MediaCardDescription>{course.description}</MediaCardDescription>
        </MediaCardContent>
      </MediaCardTrigger>

      <MediaCardPopover>
        <AIWarning brandSlug={brandSlug} />

        <MediaCardPopoverText>{course.description}</MediaCardPopoverText>

        <MediaCardPopoverMeta>
          <MediaCardPopoverSource>
            {course.organization.name}
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
      </MediaCardPopover>
    </MediaCard>
  );
}
