"use client";

import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { type LessonFit } from "@zoonk/core/view-models/onboarding/get-lesson-fit";
import { GuestLessonNext } from "@zoonk/learn/guest-ending";
import { type ComponentProps, useMemo } from "react";
import { GuestPlanStart } from "./guest-plan-start";
import { LessonPlayerClient } from "./lesson-player-client";

type EndingSlots = NonNullable<ComponentProps<typeof LessonPlayerClient>["endingSlots"]>;

/** A guest's completion moment ends with where the lesson fits and two ways to keep going. */
function createGuestEnding({ fit, goal }: { fit: LessonFit | null; goal: string }): EndingSlots {
  const start = fit?.course
    ? { chapterId: fit.course.startChapterId, courseId: fit.course.id }
    : null;

  return {
    completionActions: () => (
      <GuestLessonNext
        fit={fit}
        plan={<GuestPlanStart goal={goal} start={start} />}
        signUpHref="/login"
      />
    ),
  };
}

/**
 * The lesson player for visitors and guests: the same lesson and completion moment, then where it
 * fits, "Build my plan" (the lesson's course as their goal) and "Create an account to save".
 */
export function GuestLessonPlayer({
  fit,
  ...props
}: Omit<ComponentProps<typeof LessonPlayerClient>, "endingSlots"> & { fit: LessonFit | null }) {
  const goal = fit?.course?.title ?? props.lesson.title;
  const endingSlots = useMemo(() => createGuestEnding({ fit, goal }), [fit, goal]);

  return (
    <MainLearnProvider>
      <LessonPlayerClient {...props} endingSlots={endingSlots} />
    </MainLearnProvider>
  );
}
