"use client";

import type { Course } from "@zoonk/db";
import { useInfiniteList } from "@zoonk/ui/hooks/infinite-list";
import {
  CourseListGroup,
  type CourseListItem,
  CourseListItemView,
} from "@zoonk/ui/patterns/courses/list";
import { EmptyView } from "@zoonk/ui/patterns/empty";
import { Loader2Icon, NotebookPenIcon } from "lucide-react";
import Image from "next/image";
import { useExtracted } from "next-intl";
import { ClientLink } from "@/i18n/client-link";
import { loadMoreCourses } from "./actions";

function toCourseListItem(course: Course): CourseListItem {
  return {
    description: course.description,
    id: course.id,
    imageUrl: course.imageUrl,
    slug: course.slug,
    title: course.title,
  };
}

export function CourseListClient({
  initialCourses,
  language,
  limit,
}: {
  initialCourses: Course[];
  language: string;
  limit: number;
}) {
  const t = useExtracted();

  const {
    items: courses,
    isLoading,
    sentryRef,
  } = useInfiniteList<Course, number>({
    fetchMore: (cursor) => loadMoreCourses({ cursor, language }),
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
              <ClientLink href={`/b/zoonk/c/${course.slug}`} prefetch={false} />
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
