"use client";

import { getPathname } from "@/i18n/navigation";
import { CHAPTER_PARAM, getCourseStartHref } from "@/lib/public/public-hrefs";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowRightIcon, Loader2Icon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { useId } from "react";
import { useSharedCourseStart } from "./course-start-context";
import { CourseStartFailureNote, isStartBlocked } from "./course-start-failure";
import { getStartControlClassName } from "./public-start";

/**
 * "Start this course" (or a chapter's start) on a public page, for the course or chapter of its
 * page's `CourseStartProvider`. The tap starts the course as the visitor's goal and goes straight
 * to what onboarding still needs to ask; nothing happens until that tap. Without JavaScript it's a
 * form that opens the course's start page, which has its own button. Pending and errors show
 * under every start control of the page, announced by the one that was pressed; when only an
 * account or Plus lets it go on, that becomes the button.
 */
export function StartCourseButton({
  align = "start",
  id,
  label,
}: {
  /** The closing call centers its button, and so what shows under it. */
  align?: "center" | "start";
  id?: string;
  label: string;
}) {
  const t = useExtracted();
  const locale = useLocale();
  const controlId = useId();
  const { chapterId, courseId, failure, pending, start, startedBy } = useSharedCourseStart();
  const isBlocked = isStartBlocked(failure);
  const isPressed = startedBy === controlId;

  return (
    <form
      action={getPathname({ href: getCourseStartHref({ courseId }), locale })}
      className={cn("flex flex-col gap-3", align === "center" ? "items-center" : "sm:items-start")}
      id={id}
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        start(controlId);
      }}
    >
      {chapterId && <input name={CHAPTER_PARAM} type="hidden" value={chapterId} />}

      {!isBlocked && (
        <button className={getStartControlClassName()} disabled={pending} type="submit">
          {label}

          {pending ? (
            <Loader2Icon aria-hidden="true" className="animate-spin" data-icon="inline-end" />
          ) : (
            <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
          )}
        </button>
      )}

      {pending && isPressed && (
        <span className="sr-only" role="status">
          {t("Starting your plan…")}
        </span>
      )}

      {/* An account or Plus is then the page's one action, so it takes the start's place and look. */}
      <CourseStartFailureNote
        actionClassName={isBlocked ? getStartControlClassName() : undefined}
        announce={isPressed}
        className={
          align === "center"
            ? "mx-auto items-center text-center"
            : "max-w-none items-stretch sm:max-w-md sm:items-start"
        }
        failure={failure}
        onRetry={() => start(controlId)}
      />
    </form>
  );
}
