import { AIWarning } from "@/components/catalog/ai-warning";
import { type CourseWithDetails } from "@/data/courses/get-course";
import { Link } from "@/i18n/navigation";
import { getCategories } from "@/lib/categories/category-server";
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
  MediaCardPopoverSourceLink,
  MediaCardPopoverText,
  MediaCardTitle,
  MediaCardTrigger,
} from "@zoonk/ui/components/media-card";
import { NotebookPenIcon } from "lucide-react";
import { getLocale } from "next-intl/server";
import Image from "next/image";

export async function CourseHeader({
  brandSlug,
  course,
}: {
  brandSlug: string;
  course: CourseWithDetails;
}) {
  const locale = await getLocale();
  const categoryLabels = await getCategories({ locale });
  const courseCategoryKeys = new Set(course.categories.map((item) => item.category));

  const displayCategories = categoryLabels.filter((cat) => courseCategoryKeys.has(cat.key));

  return (
    <MediaCard>
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
        <AIWarning brandSlug={brandSlug} />

        <MediaCardPopoverText>{course.description}</MediaCardPopoverText>

        <MediaCardPopoverMeta>
          <MediaCardPopoverSource>
            <MediaCardPopoverSourceLink render={<span />}>
              {course.organization.name}
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
      </MediaCardPopover>
    </MediaCard>
  );
}
