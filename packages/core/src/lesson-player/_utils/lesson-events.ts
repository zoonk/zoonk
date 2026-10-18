import "server-only";
import { type LearningEvent } from "@zoonk/db";
import { after } from "next/server";
import { type AnalyticsEvent } from "../../analytics/events";
import { trackLearnerEvents } from "../../analytics/track-learner-event";

type LessonRun = Pick<LearningEvent, "goalId" | "lessonKind" | "userId">;

function toLessonProperties({ lessonId, run }: { lessonId: string; run: LessonRun }) {
  return { goal_id: run.goalId, lessonKind: run.lessonKind ?? "library", lesson_id: lessonId };
}

/**
 * "Lesson Started" for a new run, plus "Guest Lesson Started" when a guest opened it, which counts
 * as an arrival. Sent after the response, so opening a lesson never waits on PostHog.
 */
export function trackLessonStarted({
  isGuest,
  lessonId,
  run,
  stepCount,
}: {
  isGuest: boolean;
  lessonId: string;
  run: LessonRun;
  stepCount: number;
}): void {
  const events: AnalyticsEvent[] = [
    { name: "Lesson Started", properties: { ...toLessonProperties({ lessonId, run }), stepCount } },
    ...(isGuest
      ? [{ name: "Guest Lesson Started", properties: { lesson_id: lessonId } } as const]
      : []),
  ];

  after(() => trackLearnerEvents({ events, goalId: run.goalId, userId: run.userId }));
}

/** "Lesson Completed" for the completion that closed the run, after the response. */
export function trackLessonCompleted({
  isFirstCompletion,
  lessonId,
  run,
  seconds,
}: {
  isFirstCompletion: boolean;
  lessonId: string;
  run: LessonRun;
  seconds: number;
}): void {
  const event: AnalyticsEvent = {
    name: "Lesson Completed",
    properties: {
      ...toLessonProperties({ lessonId, run }),
      first_completion: isFirstCompletion,
      seconds,
    },
  };

  after(() => trackLearnerEvents({ events: [event], goalId: run.goalId, userId: run.userId }));
}
