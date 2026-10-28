"use client";

import {
  type CourseStartOutcome,
  startCourseAction,
} from "@/app/[lang]/(app)/(onboarding)/start/course-start-actions";
import { useRouter } from "@/i18n/navigation";
import { ensureGuestSession } from "@/lib/guest/ensure-guest-session";
import { getCourseStartHref } from "@/lib/public/public-hrefs";
import { type OnboardingOwnLevel } from "@zoonk/core/view-models/onboarding/contract";
import { safeAsync } from "@zoonk/utils/error";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useState, useTransition } from "react";

export type CourseStartFailure = Exclude<CourseStartOutcome, { status: "started" }>;

/**
 * A whole course asks the learner's level on its start page first, so a tap without one creates
 * nothing: leaving that question leaves no goal and no plan being written.
 */
export function useCourseStart({
  chapterId,
  courseId,
  dailyMinutes = null,
  initialFailure = null,
}: {
  chapterId?: string | null;
  courseId: string;
  dailyMinutes?: number | null;
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
          ? startCourseAction({
              chapterId,
              courseId,
              dailyMinutes,
              level,
              timeZone: getLocalTimeZone(),
            })
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
    startWithLevel: (level: OnboardingOwnLevel | null) => run(level),
  };
}
