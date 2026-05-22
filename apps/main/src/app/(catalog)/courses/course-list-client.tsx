"use client";

import { CatalogGridContent, CatalogGridItem } from "@/components/catalog/catalog-grid";
import { CatalogGridImage } from "@/components/catalog/catalog-grid-image";
import { type CourseWithOrg } from "@/data/courses/list-courses";
import {
  GridGroup,
  GridItemContent,
  GridItemDescription,
  GridItemMedia,
  GridItemTitle,
} from "@zoonk/ui/components/grid";
import { useInfiniteList } from "@zoonk/ui/hooks/infinite-list";
import { EmptyView } from "@zoonk/ui/patterns/empty";
import { type CourseCategory } from "@zoonk/utils/categories";
import { Loader2Icon, NotebookPenIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { loadMoreCourses } from "./actions";

/**
 * Course discovery should use the same playful tile language as curriculum
 * pages, so browsing courses feels like choosing the next learning path.
 */
function CourseTile({ course }: { course: CourseWithOrg }) {
  return (
    <CatalogGridItem
      className="min-h-56"
      href={`/b/${course.organization?.slug}/c/${course.slug}`}
      id={course.id}
      prefetch
    >
      <GridItemMedia className="size-24 sm:size-28">
        {course.imageUrl ? (
          <CatalogGridImage alt={course.title} size="compact" src={course.imageUrl} />
        ) : (
          <NotebookPenIcon aria-hidden="true" className="text-muted-foreground/80 size-8" />
        )}
      </GridItemMedia>

      <GridItemContent>
        <GridItemTitle>{course.title}</GridItemTitle>
        <GridItemDescription>{course.description}</GridItemDescription>
      </GridItemContent>
    </CatalogGridItem>
  );
}

export function CourseListClient({
  category,
  initialCourses,
  language,
  limit,
}: {
  category?: CourseCategory;
  initialCourses: CourseWithOrg[];
  language: string;
  limit: number;
}) {
  const t = useExtracted();

  const {
    items: courses,
    isLoading,
    sentryRef,
  } = useInfiniteList<CourseWithOrg>({
    fetchMore: (cursor) => loadMoreCourses({ category, cursor: String(cursor), language }),
    getKey: (course) => course.id,
    initialItems: initialCourses,
    limit,
  });

  if (courses.length === 0) {
    return (
      <EmptyView
        description={t("No courses available yet.")}
        icon={NotebookPenIcon}
        title={t("No courses")}
      />
    );
  }

  return (
    <CatalogGridContent>
      <GridGroup>
        {courses.map((course) => (
          <CourseTile course={course} key={course.id} />
        ))}
      </GridGroup>

      <div className="flex justify-center py-4" ref={sentryRef}>
        {isLoading && (
          <Loader2Icon
            aria-label={t("Loading more courses…")}
            className="text-muted-foreground size-5 animate-spin"
          />
        )}
      </div>
    </CatalogGridContent>
  );
}
