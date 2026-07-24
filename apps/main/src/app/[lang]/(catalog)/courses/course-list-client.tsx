"use client";

import { CatalogGridContent, CatalogGridItem } from "@/components/catalog/catalog-grid";
import { CatalogGridImage } from "@/components/catalog/catalog-grid-image";
import { type CourseWithOrg } from "@/data/courses/list-courses";
import { Link } from "@/i18n/navigation";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import {
  GridGroup,
  GridItemContent,
  GridItemDescription,
  GridItemMedia,
  GridItemTitle,
} from "@zoonk/ui/components/grid";
import { useInfiniteList } from "@zoonk/ui/hooks/infinite-list";
import { type CourseCategory } from "@zoonk/utils/categories";
import { Loader2Icon, NotebookPenIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { loadMoreCourses } from "./actions";

type CourseListCategory = { key: CourseCategory; label: string };

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
  category?: CourseListCategory;
  initialCourses: CourseWithOrg[];
  language: string;
  limit: number;
}) {
  const t = useExtracted();

  const {
    hasLoadError,
    items: courses,
    isLoading,
    retry,
    sentryRef,
  } = useInfiniteList<CourseWithOrg>({
    fetchMore: (cursor) =>
      loadMoreCourses({ category: category?.key, cursor: String(cursor), language }),
    getKey: (course) => course.id,
    initialItems: initialCourses,
    limit,
  });

  if (courses.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <NotebookPenIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("No courses")}</EmptyTitle>
          <EmptyDescription>{t("No courses available yet.")}</EmptyDescription>
        </EmptyHeader>

        {category && (
          <EmptyContent>
            <Link
              className={buttonVariants({
                className:
                  "h-auto min-h-9 max-w-full whitespace-normal py-2 text-center leading-snug",
                variant: "outline",
              })}
              href="/start/learn"
              prefetch
            >
              <PlusIcon aria-hidden="true" />
              <span className="min-w-0 wrap-break-word">
                {t("Create a course about {category}", { category: category.label })}
              </span>
            </Link>
          </EmptyContent>
        )}
      </Empty>
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

        {hasLoadError && !isLoading && (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <p className="text-muted-foreground text-sm">
              {t("Something went wrong. Please try again.")}
            </p>
            <Button onClick={retry} size="sm" variant="outline">
              <RefreshCwIcon aria-hidden="true" />
              {t("Try again")}
            </Button>
          </div>
        )}
      </div>
    </CatalogGridContent>
  );
}
