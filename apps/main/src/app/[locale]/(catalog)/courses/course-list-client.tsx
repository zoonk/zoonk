"use client";

import { useInfiniteList } from "@zoonk/ui/hooks/infinite-list";
import {
  CourseListGroup,
  type CourseListItem,
  CourseListItemView,
} from "@zoonk/ui/patterns/courses/list";
import { EmptyView } from "@zoonk/ui/patterns/empty";
import type { CourseCategory } from "@zoonk/utils/categories";
import { Loader2Icon, NotebookPenIcon } from "lucide-react";
import Image from "next/image";
import { useExtracted } from "next-intl";
import type { CourseWithOrg } from "@/data/courses/list-courses";
import { ClientLink } from "@/i18n/client-link";
import { loadMoreCourses } from "./actions";

function toCourseListItem(course: CourseWithOrg): CourseListItem {
  return {
    description: course.description,
    id: course.id,
    imageUrl: course.imageUrl,
    slug: course.slug,
    title: course.title,
  };
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
  } = useInfiniteList<CourseWithOrg, number>({
    fetchMore: (cursor) => loadMoreCourses({ category, cursor, language }),
    getCursor: (course) => course.id,
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
      <CourseListGroup>
        {courses.map((course) => (
          <CourseListItemView
            course={toCourseListItem(course)}
            image={
              course.imageUrl ? (
                <Image
                  alt={course.title}
                  height={64}
                  src={course.imageUrl}
                  width={64}
                />
              ) : undefined
            }
            key={course.id}
            linkComponent={
              <ClientLink
                href={`/b/${course.organization.slug}/c/${course.slug}`}
              />
            }
          />
        ))}
      </CourseListGroup>

      <div className="flex justify-center py-4" ref={sentryRef}>
        {isLoading && (
          <Loader2Icon
            aria-label={t("Loading more courses…")}
            className="size-5 animate-spin text-muted-foreground"
          />
        )}
      </div>
    </>
  );
}
