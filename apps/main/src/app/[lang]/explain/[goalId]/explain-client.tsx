"use client";

import { LessonPlayerClient } from "@/app/[lang]/learn/[lessonId]/lesson-player-client";
import { CourseStartFailureNote } from "@/components/public/course-start-failure";
import { useCourseStart } from "@/components/public/use-course-start";
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

/**
 * Where the learner goes after an explanation: back to their plan's day, or, with only
 * explanations, to asking the next question, since there's no day to plan.
 */
function getHomeHref(explanation: ExplanationView) {
  return explanation.hasStudyGoal ? "/today" : "/start";
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
 * The explanation's title as words inside a sentence: "como funciona a inflação" for "Como
 * funciona a inflação", leaving an acronym ("PIB") as it is.
 */
function toTopic(title: string): string {
  const topic = title.trim().replace(/[?!.]+$/u, "");
  const isAcronym = /^\p{Lu}{2}/u.test(topic);

  return isAcronym ? topic : topic.charAt(0).toLocaleLowerCase() + topic.slice(1);
}

/**
 * "I want to learn this in depth": the Overview course's plan in one tap, or, before a course is
 * linked (or when the subject has none), onboarding with the topic as the goal, said as the
 * learner would say it ("Quero entender a fundo como funciona a inflação").
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
      href={getGoalStartHref(
        t("I want to understand {topic} in depth", { topic: toTopic(explanation.title) }),
      )}
    />
  );
}

/**
 * The explanation's own ending replaces the lesson's completion moment, with the same "I want to
 * learn this in depth" as before it, so turning it into a goal is one tap at the end too.
 */
function createExplainEnding(explanation: ExplanationView): EndingSlots {
  const { course } = explanation.goFurther;

  return {
    completion: (slot) => (
      <>
        {!course && <GoFurtherRefresh />}
        <ExplainEnding
          deeper={<DeeperStart explanation={explanation} />}
          doneHref={getHomeHref(explanation)}
          explanation={explanation}
          questionHref={getGoalStartHref}
          result={{
            answered: slot.correctCount + slot.incorrectCount,
            brainPower: slot.completion.result?.brainPower ?? null,
            correct: slot.correctCount,
          }}
          saving={slot.completion.status === "saving"}
        />
      </>
    ),
  };
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
 * A quick explanation: a designed wait while it's written (each step live,
 * the outline taking shape; shown as soon as the run says it can be read), then the story screens
 * and the check in the lesson player, ending with "Now you know" and "Want to go further?". A
 * learner who waited sees the finished outline first and starts it with "See explanation".
 */
export function ExplainClient({
  explanation,
  hasSession,
  soundsEnabled,
}: {
  explanation: ExplanationView;
  hasSession: boolean;
  soundsEnabled: boolean;
}) {
  const router = useRouter();
  const endingSlots = useMemo(() => createExplainEnding(explanation), [explanation]);

  const routing = useMemo(
    () => ({ exit: getHomeHref(explanation), exitTo: null, nextLesson: null }),
    [explanation],
  );
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
        closeHref={getHomeHref(explanation)}
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
      endingSlots={endingSlots}
      firstAnswer={null}
      hasSession={hasSession}
      lesson={explanation.lesson}
      routing={routing}
      soundsEnabled={soundsEnabled}
      studySessionId={null}
    />
  );
}
