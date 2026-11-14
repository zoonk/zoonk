"use client";

import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { useSignUpHref } from "@/components/learn/use-sign-up-href";
import { type LessonFit } from "@zoonk/core/view-models/onboarding/get-lesson-fit";
import { GuestLessonFit, GuestSignUpLink } from "@zoonk/learn/guest-ending";
import { type ComponentProps, useMemo } from "react";
import { GuestPlanStart } from "./guest-plan-start";
import { LessonPlayerClient } from "./lesson-player-client";

type EndingSlots = NonNullable<ComponentProps<typeof LessonPlayerClient>["endingSlots"]>;

function createGuestEnding({
  fit,
  goal,
  signUpHref,
}: {
  fit: LessonFit | null;
  goal: string;
  signUpHref: string;
}): EndingSlots {
  const start = fit?.course
    ? { chapterId: fit.course.startChapterId, courseId: fit.course.id }
    : null;

  return {
    completionActions: () => (
      <GuestPlanStart
        goal={goal}
        other={<GuestSignUpLink signUpHref={signUpHref} />}
        start={start}
      />
    ),
    completionDetails: () => fit && <GuestLessonFit fit={fit} />,
  };
}

export function GuestLessonPlayer({
  fit,
  ...props
}: Omit<ComponentProps<typeof LessonPlayerClient>, "endingSlots"> & { fit: LessonFit | null }) {
  const goal = fit?.course?.title ?? props.lesson.title;
  const signUpHref = useSignUpHref();

  const endingSlots = useMemo(
    () => createGuestEnding({ fit, goal, signUpHref }),
    [fit, goal, signUpHref],
  );

  return (
    <MainLearnProvider>
      <LessonPlayerClient {...props} endingSlots={endingSlots} />
    </MainLearnProvider>
  );
}
