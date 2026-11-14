"use client";

import { type LessonFit } from "@zoonk/core/view-models/onboarding/get-lesson-fit";
import { buttonVariants } from "@zoonk/ui/components/button";
import { MeterPart, MeterParts } from "@zoonk/ui/components/meter";
import { cn } from "@zoonk/ui/lib/utils";
import { PendingLink } from "@zoonk/ui/patterns/links/pending";
import { BookOpenIcon, UserPlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { SURFACE_CLASS } from "../_components/surface";
import { TASK_WRAPPING_ACTION_CLASS } from "../_components/task-layout";
import { useFormatDuration } from "../_utils/time-format";

const MINUTES_PER_HOUR = 60;

/** Where a visitor's lesson sits in its course, under the lesson's end. */
export function GuestLessonFit({ fit }: { fit: LessonFit }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { chapter, course } = fit;
  const lessons = Math.max(1, chapter.lessonCount);

  return (
    <section className={cn(SURFACE_CLASS, "flex flex-col gap-3 p-4")}>
      <p className="text-muted-foreground text-sm">{t("This is part of")}</p>

      {course && (
        <div className="flex items-start gap-3">
          <BookOpenIcon aria-hidden="true" className="text-muted-foreground mt-1 size-4 shrink-0" />
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold">{course.title}</span>
            <span className="text-muted-foreground text-sm">
              {t("{chapters, plural, one {# chapter} other {# chapters}} · about {time}", {
                chapters: course.chapterCount,
                time: formatDuration(
                  Math.max(1, Math.round(course.minutes / MINUTES_PER_HOUR)) * MINUTES_PER_HOUR,
                ),
              })}
            </span>
          </span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between gap-3 text-xs">
          <span className="min-w-0 truncate font-medium">{chapter.title}</span>
          <span className="text-muted-foreground shrink-0 tabular-nums">
            {t("{number, number} of {total, plural, one {# lesson} other {# lessons}}", {
              number: chapter.lessonNumber,
              total: chapter.lessonCount,
            })}
          </span>
        </span>
        <MeterParts>
          {Array.from({ length: lessons }, (_, index) => (
            <MeterPart
              className={cn(index < chapter.lessonNumber && "bg-success")}
              // oxlint-disable-next-line react/no-array-index-key -- A chapter's lessons never reorder.
              key={index}
            />
          ))}
        </MeterParts>
      </div>
    </section>
  );
}

/** The visitor's way to keep what they did, beside the lesson end's main action. */
export function GuestSignUpLink({ signUpHref }: { signUpHref: string }) {
  const t = useExtracted();

  return (
    <PendingLink
      className={cn(buttonVariants({ size: "xl", variant: "outline" }), TASK_WRAPPING_ACTION_CLASS)}
      href={signUpHref}
      icon={<UserPlusIcon aria-hidden="true" />}
    >
      {t("Create an account to save")}
    </PendingLink>
  );
}
