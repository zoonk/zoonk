"use client";

import { CatalogGridContent, CatalogGridItem } from "@/components/catalog/catalog-grid";
import { CatalogGridImage } from "@/components/catalog/catalog-grid-image";
import { Link } from "@/i18n/navigation";
import { CATEGORY_ICONS } from "@/lib/categories/category-icons";
import { type CourseWithOrg } from "@zoonk/core/courses/list";
import { KindTile } from "@zoonk/learn/kind-tile";
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
import { LanguageFlag, hasLanguageFlag } from "@zoonk/ui/components/language-flag";
import { useInfiniteList } from "@zoonk/ui/hooks/infinite-list";
import { type CourseCategory } from "@zoonk/utils/categories";
import { getLanguageFlagLabel } from "@zoonk/utils/language-flags";
import { getFirstSentence } from "@zoonk/utils/string";
import {
  ChevronRightIcon,
  Loader2Icon,
  NotebookPenIcon,
  PlusIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { loadMoreCourses } from "./actions";

/** About the first two rows of the grid on the widest screens, where the largest paint is. */
const ABOVE_THE_FOLD_TILES = 10;

/**
 * A course's picture is its anchor. A language course without one shows the flag of the variety it
 * teaches; any other course gets the course tile in the lesson color, with its category's icon
 * when the page is a category, so it reads as a course and not as a missing picture.
 */
function CourseTileMedia({
  category,
  course,
  eager,
}: {
  category?: CourseCategory;
  course: CourseWithOrg;
  eager: boolean;
}) {
  const locale = useLocale();

  if (course.imageUrl) {
    return <CatalogGridImage alt={course.title} eager={eager} src={course.imageUrl} />;
  }

  if (hasLanguageFlag(course.targetLanguage)) {
    return (
      <LanguageFlag
        alt={getLanguageFlagLabel({ language: course.targetLanguage, userLanguage: locale }) ?? ""}
        className="w-4/5"
        language={course.targetLanguage}
      />
    );
  }

  return (
    <KindTile
      className="size-4/5 rounded-3xl [&>svg]:size-10"
      icon={category ? CATEGORY_ICONS[category] : undefined}
      kind="lesson"
      size="lg"
    />
  );
}

/**
 * A course as a card: its picture, its title and the first sentence of what it is; on phones a
 * row of the list, with the chevron that says it opens.
 */
function CourseTile({
  category,
  course,
  eager,
}: {
  category?: CourseCategory;
  course: CourseWithOrg;
  eager: boolean;
}) {
  return (
    <CatalogGridItem href={`/b/${course.organization?.slug}/c/${course.slug}`} prefetch>
      <GridItemMedia className="max-sm:size-14">
        <CourseTileMedia category={category} course={course} eager={eager} />
      </GridItemMedia>

      <GridItemContent>
        <GridItemTitle>{course.title}</GridItemTitle>
        {course.description && (
          <GridItemDescription>
            {getFirstSentence(course.description, course.language)}
          </GridItemDescription>
        )}
      </GridItemContent>

      <ChevronRightIcon
        aria-hidden="true"
        className="text-muted-foreground/60 -ml-2 size-4 shrink-0 sm:hidden"
      />
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
    hasLoadError,
    items: courses,
    isLoading,
    retry,
    sentryRef,
  } = useInfiniteList<CourseWithOrg>({
    fetchMore: (cursor) => loadMoreCourses({ category, cursor: String(cursor), language }),
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
            <Link className={buttonVariants({ variant: "outline" })} href="/start" prefetch>
              <PlusIcon aria-hidden="true" />
              {t("Start a goal")}
            </Link>
          </EmptyContent>
        )}
      </Empty>
    );
  }

  return (
    <CatalogGridContent>
      <GridGroup>
        {courses.map((course, index) => (
          <CourseTile
            category={category}
            course={course}
            eager={index < ABOVE_THE_FOLD_TILES}
            key={course.id}
          />
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
