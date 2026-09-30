"use client";

import { type LessonFit } from "@zoonk/core/view-models/onboarding/get-lesson-fit";
import { buttonVariants } from "@zoonk/ui/components/button";
import { Progress } from "@zoonk/ui/components/progress";
import { cn } from "@zoonk/ui/lib/utils";
import { BookOpenIcon, CalendarClockIcon } from "lucide-react";
import { useExtracted, useFormatter, useLocale } from "next-intl";
import { type ReactNode } from "react";
import { LearnLink } from "../learn-link";

const MINUTES_PER_HOUR = 60;

function WhereItFits({ fit }: { fit: LessonFit }) {
  const t = useExtracted();
  const locale = useLocale();
  const format = useFormatter();
  const { chapter, course } = fit;

  return (
    <section className="bg-card ring-foreground/10 in-data-[mode=fun]:fun-glass flex flex-col gap-3 rounded-3xl p-4 ring-1">
      <p className="text-muted-foreground text-sm">{t("This is part of")}</p>

      {course && (
        <div className="flex items-center gap-3">
          <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-xl">
            <BookOpenIcon aria-hidden="true" className="size-5" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold">{course.title}</span>
            <span className="text-muted-foreground text-sm">
              {t(
                "{chapters, plural, one {# chapter} other {# chapters}} · about {hours} at your pace",
                {
                  chapters: course.chapterCount,
                  hours: format.number(Math.max(1, Math.round(course.minutes / MINUTES_PER_HOUR)), {
                    style: "unit",
                    unit: "hour",
                    unitDisplay: "narrow",
                  }),
                },
              )}
            </span>
          </span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Progress
          locale={locale}
          aria-label={t("Lessons done in this chapter")}
          className="**:data-[slot=progress-track]:h-1.5"
          value={(chapter.lessonNumber / Math.max(1, chapter.lessonCount)) * 100}
        />
        <span className="text-muted-foreground self-end text-xs">
          {t("{chapter} · {number, number} of {total, number}", {
            chapter: chapter.title,
            number: chapter.lessonNumber,
            total: chapter.lessonCount,
          })}
        </span>
      </div>
    </section>
  );
}

/**
 * What comes after a guest's lesson from a public page: where it fits, and two ways on. "Build
 * my plan" (`plan`, the host's control) starts a plan from this lesson's course without typing
 * it again; an account keeps the lesson and its review, since signing up moves the guest's
 * progress to it.
 */
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
        <LearnLink
          className={cn(
            buttonVariants({ size: "lg", variant: "outline" }),
            "in-data-[mode=fun]:fun-glass h-12 w-full rounded-full text-base",
          )}
          href={signUpHref}
        >
          {t("Create an account to save")}
        </LearnLink>
      </div>
    </div>
  );
}
