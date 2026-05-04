"use client";

import { type CourseWithOrg } from "@/data/courses/list-courses";
import {
  CatalogListGroup,
  CatalogListItem,
  CatalogListItemContent,
  CatalogListItemDescription,
  CatalogListItemIcon,
  CatalogListItemImage,
  CatalogListItemTitle,
} from "@zoonk/ui/components/catalog-list";
import { useInfiniteList } from "@zoonk/ui/hooks/infinite-list";
import { EmptyView } from "@zoonk/ui/patterns/empty";
import { type CourseCategory } from "@zoonk/utils/categories";
import { Loader2Icon, NotebookPenIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { loadMoreCourses } from "./actions";

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
    <>
      <CatalogListGroup>
        {courses.map((course) => (
          <CatalogListItem
            key={course.id}
            render={<Link href={`/b/${course.organization?.slug}/c/${course.slug}`} prefetch />}
          >
            {course.imageUrl ? (
              <CatalogListItemImage>
                <Image alt="" height={64} src={course.imageUrl} width={64} />
              </CatalogListItemImage>
            ) : (
              <CatalogListItemIcon>
                <NotebookPenIcon aria-hidden="true" className="text-muted-foreground/80 size-6" />
              </CatalogListItemIcon>
            )}

            <CatalogListItemContent>
              <CatalogListItemTitle>{course.title}</CatalogListItemTitle>
              <CatalogListItemDescription>{course.description}</CatalogListItemDescription>
            </CatalogListItemContent>
          </CatalogListItem>
        ))}
      </CatalogListGroup>

      <div className="flex justify-center py-4" ref={sentryRef}>
        {isLoading && (
          <Loader2Icon
            aria-label={t("Loading more courses…")}
            className="text-muted-foreground size-5 animate-spin"
          />
        )}
      </div>
    </>
  );
}
