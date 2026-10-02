"use client";

import {
  type CourseStartOutcome,
  startCourseAction,
} from "@/app/[lang]/start/course-start-actions";
import { useRouter } from "@/i18n/navigation";
import { ensureGuestSession } from "@/lib/guest/ensure-guest-session";
import { safeAsync } from "@zoonk/utils/error";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useState, useTransition } from "react";

/** Why a start didn't go on, for the button to say in place. */
export type CourseStartFailure = Exclude<CourseStartOutcome, { status: "started" }>;

/**
 * Starting a course from the learner's tap: they become a guest first when they have no session
 * (nothing is created before that tap, so crawlers following the page create nothing), then the
 * goal starts and they go on to its remaining onboarding, or to their day when it's their goal
 * already. Pending lasts until the next page shows; a refusal or failure stays for the button to
 * say, with a way to try again.
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

  const start = () =>
    startTransition(async () => {
      setFailure(null);

      const { data } = await safeAsync(async () =>
        (await ensureGuestSession())
          ? startCourseAction({ chapterId, courseId, timeZone: getLocalTimeZone() })
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

  return { failure, pending, start };
}
