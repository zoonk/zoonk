"use client";

import { CatalogBackToTop } from "@/components/catalog/catalog-back-to-top";
import { CourseMark } from "@/components/catalog/course-mark";
import { Link } from "@/i18n/navigation";
import { getTotalDuration } from "@/lib/public/total-duration";
import { type CourseWithOrg } from "@zoonk/core/courses/list";
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
import {
  ChevronRightIcon,
  Loader2Icon,
  NotebookPenIcon,
  PlusIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { loadMoreCourses } from "./actions";
import { COURSE_LIST_CLASS } from "./course-list-styles";

const MINUTES_PER_HOUR = 60;

/**
 * Under `lg` a course is a row of the app's flat list: its highlight drawn behind it, a little past
 * the column's edges, so the hairlines between rows run straight. From `lg` it's a card.
 */
const COURSE_LINK_CLASS =
  "relative isolate flex h-full min-w-0 items-start gap-3 py-3 outline-none before:pointer-events-none before:absolute before:-inset-x-2.5 before:inset-y-0.5 before:-z-10 before:rounded-[0.625rem] before:transition-colors hover:before:bg-muted/70 focus-visible:before:ring-[3px] focus-visible:before:ring-ring/50 lg:bg-card lg:ring-border lg:hover:ring-input lg:flex-col lg:rounded-xl lg:p-4 lg:ring-1 lg:transition-[--tw-ring-color] lg:before:hidden lg:focus-visible:ring-[3px] lg:focus-visible:ring-ring/50";

/** How long a course takes, from its lessons' estimates, as its own page says it. */
function useDurationLabel(totalMinutes: number) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const duration = getTotalDuration(totalMinutes);

  if ("minutes" in duration) {
    return formatDuration(duration.minutes);
  }

  return t("about {time}", { time: formatDuration(duration.hours * MINUTES_PER_HOUR) });
}

/**
 * The course in numbers, in mono under its words: "37 lessons · about 2 hr", the numbers its page
 * states. A course whose lessons aren't written yet has no numbers to show. On a card it sits at
 * the bottom, so the cards of a row line theirs up; a narrow card balances it over two lines
 * rather than leaving "hr" alone on the second.
 */
function CourseMeta({ course }: { course: CourseWithOrg }) {
  const t = useExtracted();
  const duration = useDurationLabel(course.estimatedMinutes);

  if (course.lessonCount === 0) {
    return null;
  }

  return (
    <span className="text-muted-foreground mt-0.5 font-mono text-xs text-balance tabular-nums lg:mt-auto lg:pt-2">
      {t("{count, plural, one {# lesson} other {# lessons}} · {duration}", {
        count: course.lessonCount,
        duration,
      })}
    </span>
  );
}

/**
 * A course: its mark, its title, the first sentence of what it is and its numbers. On phones and
 * tablets a row, with the chevron that says it opens; from `lg` a card.
 */
function CourseItem({ course }: { course: CourseWithOrg }) {
  const locale = useLocale();

  return (
    <li className="min-w-0">
      <Link
        className={COURSE_LINK_CLASS}
        href={`/b/${course.organization.slug}/c/${course.slug}`}
        prefetch
      >
        <CourseMark course={course} locale={locale} />

        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[0.9375rem] leading-snug font-semibold text-pretty">
            {course.title}
          </span>

          {course.description && (
            <span className="text-muted-foreground line-clamp-2 text-[0.8125rem] leading-snug">
              {getFirstSentence(course.description, course.language)}
            </span>
          )}

          <CourseMeta course={course} />
        </span>

        <ChevronRightIcon
          aria-hidden="true"
          className="text-muted-foreground/60 size-4 shrink-0 self-center lg:hidden"
        />
      </Link>
    </li>
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
    <div className="flex min-w-0 flex-col gap-6">
      <ul aria-label={t("Courses")} className={COURSE_LIST_CLASS}>
        {courses.map((course) => (
          <CourseItem course={course} key={course.id} />
        ))}
      </ul>

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
