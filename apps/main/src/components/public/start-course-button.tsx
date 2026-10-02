"use client";

import { getPathname } from "@/i18n/navigation";
import { CHAPTER_PARAM, getCourseStartHref } from "@/lib/public/public-hrefs";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowRightIcon, Loader2Icon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { CourseStartFailureNote } from "./course-start-failure";
import { getStartControlClassName } from "./public-start";
import { useCourseStart } from "./use-course-start";

/**
 * "Start this course" (or a chapter's start) on a public page. The tap starts the course as the
 * visitor's goal and goes straight to what onboarding still needs to ask; nothing happens until
 * that tap. Without JavaScript it's a form that opens the course's start page, which has its own
 * button. Pending and errors show right here.
 */
export function StartCourseButton({
  align = "start",
  chapterId,
  courseId,
  id,
  label,
}: {
  /** The closing call centers its button, and so what shows under it. */
  align?: "center" | "start";
  chapterId?: string;
  courseId: string;
  id?: string;
  label: string;
}) {
  const t = useExtracted();
  const locale = useLocale();
  const { failure, pending, start } = useCourseStart({ chapterId, courseId });

  return (
    <form
      action={getPathname({ href: getCourseStartHref({ courseId }), locale })}
      className={cn("flex flex-col gap-3", align === "center" ? "items-center" : "sm:items-start")}
      id={id}
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        start();
      }}
    >
      {chapterId && <input name={CHAPTER_PARAM} type="hidden" value={chapterId} />}

      <button className={getStartControlClassName()} disabled={pending} type="submit">
        {label}

        {pending ? (
          <Loader2Icon aria-hidden="true" className="animate-spin" data-icon="inline-end" />
        ) : (
          <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
        )}
      </button>

      {pending && (
        <span className="sr-only" role="status">
          {t("Starting your plan…")}
        </span>
      )}

      <CourseStartFailureNote
        className={align === "center" ? "mx-auto items-center text-center" : undefined}
        failure={failure}
        onRetry={start}
      />
    </form>
  );
}
