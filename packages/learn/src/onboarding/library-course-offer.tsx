"use client";

import { type OnboardingLibraryCourse } from "@zoonk/core/view-models/onboarding/contract";
import { BookOpenIcon, ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { LearnLink } from "../learn-link";

/**
 * A ready-made Library course that teaches the goal, offered once the answers made the subject
 * clear: the learner can open it instead of, or next to, their own plan.
 */
export function LibraryCourseOffer({
  course,
  href,
}: {
  course: OnboardingLibraryCourse;
  href: string;
}) {
  const t = useExtracted();

  return (
    <LearnLink
      className="bg-card ring-foreground/10 hover:bg-muted/60 focus-visible:ring-ring/50 flex min-h-16 items-center gap-3 rounded-3xl px-4 py-3 ring-1 outline-none focus-visible:ring-[3px]"
      href={href}
    >
      <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-xl">
        <BookOpenIcon aria-hidden="true" className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-muted-foreground text-xs">
          {t("A course in the Library fits your goal")}
        </span>
        <span className="font-medium">{course.title}</span>
        {course.chapterCount > 0 && (
          <span className="text-muted-foreground text-sm">
            {t("{count, plural, one {# chapter} other {# chapters}}", {
              count: course.chapterCount,
            })}
          </span>
        )}
      </span>
      <ChevronRightIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
    </LearnLink>
  );
}
