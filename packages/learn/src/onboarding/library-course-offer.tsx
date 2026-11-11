"use client";

import { type OnboardingLibraryCourse } from "@zoonk/core/view-models/onboarding/contract";
import { BookOpenIcon, ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { LearnLink } from "../learn-link";

/** A quiet way out of a wait, while nothing is ready: a Library course that fits the goal now. */
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
      className="hover:bg-muted/60 focus-visible:ring-ring/50 -mx-2 flex min-h-11 min-w-0 items-center gap-3 rounded-lg px-2 py-1.5 outline-none focus-visible:ring-[3px] lg:max-w-md"
      href={href}
      prefetch="auto"
    >
      <BookOpenIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{course.title}</span>
        <span className="text-muted-foreground text-xs text-pretty">
          {t("A Library course fits your goal. Start it now")}
        </span>
      </span>
      <ChevronRightIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
    </LearnLink>
  );
}
