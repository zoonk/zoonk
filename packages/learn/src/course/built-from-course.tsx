"use client";

import { type PlanCourseView } from "@zoonk/core/plans/course-contract";
import { LibraryIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { LearnLink } from "../learn-link";

/** Rich text's link part, pointing at the course's page. */
function renderCourseLink(href: string) {
  return function CourseLink(chunks: React.ReactNode) {
    return (
      <LearnLink className="text-foreground font-medium underline underline-offset-4" href={href}>
        {chunks}
      </LearnLink>
    );
  };
}

function renderCourseName(chunks: React.ReactNode) {
  return <strong className="text-foreground font-semibold">{chunks}</strong>;
}

/** A plan that picks some chapters of a public Library course names it and links to all of it. */
export function isCourseSubset(course: PlanCourseView | null): course is PlanCourseView {
  return (
    course !== null &&
    course.brandSlug !== null &&
    course.planChapterCount > 0 &&
    course.planChapterCount < course.chapterCount
  );
}

/**
 * "Built from the Statistics course · 14 of 62 chapters · See full course": shown when the plan
 * picks part of a public Library course, with a link to the whole course.
 */
export function BuiltFromCourse({
  course,
  courseHref,
}: {
  course: PlanCourseView;
  courseHref: string;
}) {
  const t = useExtracted();

  return (
    <div className="bg-muted in-data-[mode=fun]:fun-glass flex items-start gap-3 rounded-2xl p-3">
      <span
        aria-hidden="true"
        className="bg-background text-muted-foreground in-data-[mode=fun]:bg-fun-soft flex size-11 shrink-0 items-center justify-center rounded-xl"
      >
        <LibraryIcon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5 text-sm">
        <p className="text-muted-foreground">
          {t.rich("Built from the <course>{title}</course> course", {
            course: renderCourseName,
            title: course.title,
          })}
        </p>
        <p className="text-muted-foreground text-xs">
          {t.rich("{count, number} of {total, number} chapters · <link>See full course</link>", {
            count: course.planChapterCount,
            link: renderCourseLink(courseHref),
            total: course.chapterCount,
          })}
        </p>
      </div>
    </div>
  );
}
