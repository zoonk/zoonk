"use client";

import { LessonPlayerClient } from "@/app/[lang]/learn/[lessonId]/lesson-player-client";
import { CourseStartFailureNote } from "@/components/public/course-start-failure";
import { useCourseStart } from "@/components/public/use-course-start";
import { getCourseHref } from "@/data/courses/course-href";
import { useRouter } from "@/i18n/navigation";
import { recordGenerationWaitAction } from "@/lib/lessons/generation-wait-action";
import { getGoalStartHref } from "@/lib/public/public-hrefs";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { type ExplanationView } from "@zoonk/core/view-models/explain/contract";
import { ExplainEnding } from "@zoonk/learn/explain/ending";
import {
  ExplainDeeperButton,
  ExplainDeeperLink,
  ExplainWaiting,
} from "@zoonk/learn/explain/waiting";
import { type LearnBuddy } from "@zoonk/learn/navigation";
import { useExtracted, useLocale } from "next-intl";
import { type ComponentProps, useEffect, useMemo, useRef, useState } from "react";
import { retryExplanationAction } from "./explain-actions";

type EndingSlots = NonNullable<ComponentProps<typeof LessonPlayerClient>["endingSlots"]>;

/**
 * The course to go further is linked a few seconds after the explanation can be read, so an
 * ending rendered before that asks the page for it once.
 */
function GoFurtherRefresh() {
  const router = useRouter();

  useEffect(() => {
    router.refresh();
  }, [router]);

  return null;
}

/** The explanation's own ending replaces the lesson's completion moment. */
function createExplainEnding(explanation: ExplanationView): EndingSlots {
  const { course } = explanation.goFurther;

  const courseHref = course
    ? getCourseHref({ brandSlug: course.brandSlug, courseSlug: course.courseSlug })
    : null;

  return {
    completion: (slot) => (
      <>
        {!course && <GoFurtherRefresh />}
        <ExplainEnding
          courseHref={courseHref}
          doneHref="/today"
          explanation={explanation}
          questionHref={getGoalStartHref}
          result={{
            answered: slot.correctCount + slot.incorrectCount,
            brainPower: slot.completion.result?.brainPower ?? null,
            correct: slot.correctCount,
          }}
        />
      </>
    ),
  };
}

type GoFurtherCourse = NonNullable<ExplanationView["goFurther"]["course"]>;

/**
 * "Build a {course} plan" in one tap: the subject's Overview course becomes the learner's goal
 * (no goal to type or confirm), and they go on to what onboarding still asks. A refusal or
 * failure says so under the row, with what to do about it.
 */
function CourseDeeperStart({ course }: { course: GoFurtherCourse }) {
  const t = useExtracted();
  const { failure, pending, start } = useCourseStart({ courseId: course.id });

  return (
    <div className="flex flex-col gap-3">
      <ExplainDeeperButton
        description={t("Build a {course} plan", { course: course.title })}
        onClick={start}
        pending={pending}
      />

      <CourseStartFailureNote className="max-w-none" failure={failure} onRetry={start} />
    </div>
  );
}

/**
 * "I want to learn this in depth": the Overview course's plan in one tap, or, before a course is
 * linked (or when the subject has none), onboarding with the topic as the goal.
 */
function DeeperStart({ explanation }: { explanation: ExplanationView }) {
  const t = useExtracted();
  const { course } = explanation.goFurther;

  if (course) {
    return <CourseDeeperStart course={course} />;
  }

  return (
    <ExplainDeeperLink
      description={t("Build a plan for the whole subject")}
      href={getGoalStartHref(t("Learn in depth: {topic}", { topic: explanation.title }))}
    />
  );
}

/**
 * "Generation Waited" (explanation), from the first waiting screen until the explanation is
 * written. One opened already written waited for nothing, so it sends nothing.
 */
function useExplanationWait(isWritten: boolean) {
  const locale = useLocale();
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!isWritten) {
      startedAt.current ??= Date.now();
      return;
    }

    if (startedAt.current === null) {
      return;
    }

    const milliseconds = Date.now() - startedAt.current;
    startedAt.current = null;
    void recordGenerationWaitAction({ contentKind: "explanation", locale, milliseconds });
  }, [isWritten, locale]);
}

/**
 * A quick explanation in the learner's mode: a designed wait while it's written (each step live,
 * the outline taking shape; shown as soon as the run says it can be read), then the story screens
 * and the check in the lesson player, ending with "Now you know" and "Want to go further?". A
 * learner who waited sees the finished outline first and starts it with "See explanation".
 */
export function ExplainClient({
  explanation,
  hasSession,
  buddy,
  soundsEnabled,
}: {
  explanation: ExplanationView;
  hasSession: boolean;
  buddy: LearnBuddy | null;
  soundsEnabled: boolean;
}) {
  const router = useRouter();
  const endingSlots = useMemo(() => createExplainEnding(explanation), [explanation]);
  // A learner who waited sees the finished outline first; one opening a ready one plays it.
  const [phase, setPhase] = useState<"outline" | "playing">(() =>
    explanation.lesson ? "playing" : "outline",
  );

  useExplanationWait(Boolean(explanation.lesson));

  const progress = useWorkflowRun({
    generationId: explanation.generationId,
    kind: "explanation",
    // The run says when the explanation can be read: the page shows it at once.
    onReady: () => {
      if (!explanation.lesson) {
        router.refresh();
      }
    },
    restart: () => retryExplanationAction(explanation.goalId),
  });

  if (!explanation.lesson || phase === "outline") {
    return (
      <ExplainWaiting
        closeHref="/today"
        deeper={<DeeperStart explanation={explanation} />}
        explanation={explanation}
        onCheck={() => router.refresh()}
        onRetry={() => retryExplanationAction(explanation.goalId)}
        onStart={() => setPhase("playing")}
        progress={progress}
      />
    );
  }

  return (
    <LessonPlayerClient
      canAskTutor={false}
      endingSlots={endingSlots}
      firstAnswer={null}
      hasSession={hasSession}
      lesson={explanation.lesson}
      buddy={buddy}
      soundsEnabled={soundsEnabled}
      studySessionId={null}
    />
  );
}
