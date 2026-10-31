"use client";

import { type LessonFit } from "@zoonk/core/view-models/onboarding/get-lesson-fit";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { BookOpenIcon, CalendarClockIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { MeterPart, MeterParts } from "../_components/meter";
import { useFormatDuration } from "../_utils/time-format";

const MINUTES_PER_HOUR = 60;

function WhereItFits({ fit }: { fit: LessonFit }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { chapter, course } = fit;
  const lessons = Math.max(1, chapter.lessonCount);

  return (
    <section className="bg-card ring-border flex flex-col gap-3 rounded-xl p-4 ring-1">
      <p className="text-muted-foreground text-sm">{t("This is part of")}</p>

      {course && (
        <div className="flex items-start gap-3">
          <BookOpenIcon aria-hidden="true" className="text-muted-foreground mt-1 size-4 shrink-0" />
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold">{course.title}</span>
            <span className="text-muted-foreground text-sm">
              {t(
                "{chapters, plural, one {# chapter} other {# chapters}} · about {time} at your pace",
                {
                  chapters: course.chapterCount,
                  time: formatDuration(
                    Math.max(1, Math.round(course.minutes / MINUTES_PER_HOUR)) * MINUTES_PER_HOUR,
                  ),
                },
              )}
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

export function GuestLessonNext({
  fit,
  plan,
  signUpHref,
}: {
  fit: LessonFit | null;
  plan: ReactNode;
  signUpHref: string;
}) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-6" data-slot="guest-lesson-next">
      {fit && <WhereItFits fit={fit} />}

      <p className="text-muted-foreground flex items-start gap-2 text-sm">
        <CalendarClockIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {t("Save your progress and a quick review comes back to help it stick.")}
      </p>

      <div className="flex flex-col gap-2">
        {plan}
        <a
          className={cn(buttonVariants({ size: "lg", variant: "outline" }), "w-full")}
          href={signUpHref}
        >
          {t("Create an account to save")}
        </a>
      </div>
    </div>
  );
}
