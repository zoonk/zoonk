"use client";

import { CatalogBackToTop } from "@/components/catalog/catalog-back-to-top";
import { CourseMark } from "@/components/catalog/course-mark";
import { Link } from "@/i18n/navigation";
import { getTotalDuration } from "@/lib/public/total-duration";
import { type CourseWithOrg } from "@zoonk/core/courses/list";
import { SubjectLabel, getSubject } from "@zoonk/learn/subject-label";
import { useFormatDuration } from "@zoonk/learn/time-format";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { useInfiniteList } from "@zoonk/ui/hooks/infinite-list";
import { type CourseCategory } from "@zoonk/utils/categories";
import { getFirstSentence } from "@zoonk/utils/string";
import { Loader2Icon, NotebookPenIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { loadMoreCourses } from "./actions";
import {
  COURSE_CELL_CLASS,
  COURSE_GRID_CLASS,
  COURSE_GRID_FRAME_CLASS,
} from "./course-list-styles";

const MINUTES_PER_HOUR = 60;

/** The focus ring sits inside its edges, which the grid's frame clips. */
const COURSE_LINK_CLASS =
  "hover:bg-muted/60 focus-visible:ring-ring/50 relative flex h-full min-w-0 items-start gap-3.5 px-4 py-4 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-inset sm:px-5 lg:flex-col lg:gap-4 lg:py-5 motion-reduce:transition-none";

function useDurationLabel(totalMinutes: number) {
  const formatDuration = useFormatDuration();
  const duration = getTotalDuration(totalMinutes);

  if ("minutes" in duration) {
    return formatDuration(duration.minutes);
  }

  return `~${formatDuration(duration.hours * MINUTES_PER_HOUR)}`;
}

function CourseMeta({ course }: { course: CourseWithOrg }) {
  const t = useExtracted();
  const duration = useDurationLabel(course.estimatedMinutes);

  if (course.lessonCount === 0) {
    return null;
  }

  return (
    <span className="text-muted-foreground mt-1.5 font-mono text-xs text-balance tabular-nums lg:mt-auto lg:pt-3">
      {t("{count, plural, one {# lesson} other {# lessons}} · {duration}", {
        count: course.lessonCount,
        duration,
      })}
    </span>
  );
}

function CourseItem({
  category,
  course,
  subjectNames,
}: {
  category?: CourseCategory;
  course: CourseWithOrg;
  subjectNames: Readonly<Record<string, string>>;
}) {
  const locale = useLocale();
  const subject = getSubject(course.categories);
  const subjectName = subject === category ? null : subjectNames[subject];

  return (
    <li className={COURSE_CELL_CLASS}>
      <Link
        className={COURSE_LINK_CLASS}
        href={`/b/${course.organization.slug}/c/${course.slug}`}
        prefetch
      >
        <CourseMark course={course} locale={locale} />

        <span className="flex min-w-0 flex-1 flex-col self-stretch">
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0 text-[0.9375rem] leading-snug font-semibold text-pretty">
              {course.title}
            </span>

            {subjectName && (
              <SubjectLabel className="lg:hidden" subject={subject}>
                {subjectName}
              </SubjectLabel>
            )}
          </span>

          {course.description && (
            <span className="text-muted-foreground mt-1 line-clamp-2 text-[0.8125rem] leading-snug">
              {getFirstSentence(course.description, course.language)}
            </span>
          )}

          <CourseMeta course={course} />
        </span>

        {subjectName && (
          <SubjectLabel
            className="absolute top-7.25 right-5 hidden lg:inline-flex"
            subject={subject}
          >
            {subjectName}
          </SubjectLabel>
        )}
      </Link>
    </li>
  );
}

export function CourseListClient({
  category,
  initialCourses,
  language,
  limit,
  subjectNames,
}: {
  category?: CourseCategory;
  initialCourses: CourseWithOrg[];
  language: string;
  limit: number;
  subjectNames: Readonly<Record<string, string>>;
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
    <div className="flex min-w-0 flex-col gap-6">
      <div className={COURSE_GRID_FRAME_CLASS}>
        <ul aria-label={t("Courses")} className={COURSE_GRID_CLASS}>
          {courses.map((course) => (
            <CourseItem
              category={category}
              course={course}
              key={course.id}
              subjectNames={subjectNames}
            />
          ))}
        </ul>
      </div>

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

      <CatalogBackToTop />
    </div>
  );
}
