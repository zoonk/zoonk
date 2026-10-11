"use client";

import {
  type CourseStartOutcome,
  startCourseAction,
} from "@/app/[lang]/start/course-start-actions";
import { useRouter } from "@/i18n/navigation";
import { ensureGuestSession } from "@/lib/guest/ensure-guest-session";
import { getCourseStartHref } from "@/lib/public/public-hrefs";
import { type OnboardingOwnLevel } from "@zoonk/core/view-models/onboarding/contract";
import { safeAsync } from "@zoonk/utils/error";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useState, useTransition } from "react";

/** Why a start didn't go on, for the button to say in place. */
export type CourseStartFailure = Exclude<CourseStartOutcome, { status: "started" }>;

/**
 * Starting a course from the learner's tap. A whole course first asks the learner's level on its
 * start page, so a tap without one (a course page's button, "Build my plan") goes there and
 * creates nothing: leaving that question leaves no goal and no plan being written. A chapter, or
 * the start page with the level answered, starts it: the learner becomes a guest first when they
 * have no session (crawlers following the page create nothing), then the goal starts and they go
 * on to its remaining onboarding, or to their day when it's their goal already. Pending lasts
 * until the next page shows; a refusal or failure stays for the button to say, with a way to try
 * again.
 */
export function useCourseStart({
  chapterId,
  courseId,
  initialFailure = null,
}: {
  chapterId?: string | null;
  courseId: string;
  /** Why the start page's form came back without JavaScript, until the next try. */
  initialFailure?: CourseStartFailure | null;
}) {
  const router = useRouter();
  const [failure, setFailure] = useState<CourseStartFailure | null>(initialFailure);
  const [pending, startTransition] = useTransition();

  const run = (level?: OnboardingOwnLevel | null) =>
    startTransition(async () => {
      setFailure(null);

      if (!chapterId && level === undefined) {
        router.push(getCourseStartHref({ courseId }));
        return;
      }

      const { data } = await safeAsync(async () =>
        (await ensureGuestSession())
          ? startCourseAction({ chapterId, courseId, level, timeZone: getLocalTimeZone() })
          : null,
      );

      const outcome: CourseStartOutcome = data ?? { status: "failed" };

      if (outcome.status !== "started") {
        setFailure(outcome);
        return;
      }

      if (outcome.next === "today") {
        router.push("/today");
        return;
      }

      router.push(`/start/${outcome.goalId}`);
    });

  return {
    failure,
    pending,
    start: () => run(),
    /** The start page's start, with the level it asked (null for a quick test). */
    startWithLevel: (level: OnboardingOwnLevel | null) => run(level),
  };
}
