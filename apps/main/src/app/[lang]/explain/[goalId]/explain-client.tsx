"use client";

import { type TutorViewer } from "@/components/learn/main-ask-tutor";
import { useRouter } from "@/i18n/navigation";
import { recordGenerationWaitAction } from "@/lib/lessons/generation-wait-action";
import { getCourseStartHref, getGoalStartHref } from "@/lib/public/public-hrefs";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { type LessonTutorSuggestion } from "@zoonk/core/lesson-questions/contract";
import { type ExplanationView } from "@zoonk/core/view-models/explain/contract";
import { ExplainEnding } from "@zoonk/learn/explain/ending";
import { ExplainDeeperLink, ExplainWaiting } from "@zoonk/learn/explain/waiting";
import { getLessonCelebration } from "@zoonk/learn/session/lesson-celebration";
import { useExtracted, useLocale } from "next-intl";
import { type ComponentProps, startTransition, useEffect, useMemo, useRef, useState } from "react";
import { retryExplanationAction } from "./explain-actions";
import { LazyLessonPlayer } from "./lazy-lesson-player";
import { preloadLessonPlayer } from "./lesson-player-code";

type EndingSlots = NonNullable<ComponentProps<typeof LazyLessonPlayer>["endingSlots"]>;

/** The course to go further is linked a few seconds after the explanation can be read. */
function GoFurtherRefresh() {
  const router = useRouter();

  useEffect(() => {
    router.refresh();
  }, [router]);

  return null;
}

function getHomeHref(explanation: ExplanationView) {
  return explanation.hasStudyGoal ? "/today" : "/start";
}

function toTopic(title: string): string {
  const topic = title.trim().replace(/[?!.]+$/u, "");
  const isAcronym = /^\p{Lu}{2}/u.test(topic);

  return isAcronym ? topic : topic.charAt(0).toLocaleLowerCase() + topic.slice(1);
}

function DeeperStart({ explanation }: { explanation: ExplanationView }) {
  const t = useExtracted();
  const { course } = explanation.goFurther;

  if (course) {
    return (
      <ExplainDeeperLink
        description={t("Build a plan for {course}", { course: course.title })}
        href={getCourseStartHref({ courseId: course.id })}
      />
    );
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

function createExplainEnding({
  buddy,
  explanation,
}: {
  buddy: TutorViewer["buddy"];
  explanation: ExplanationView;
}): EndingSlots {
  const { course } = explanation.goFurther;

  return {
    completion: (slot) => (
      <>
        {!course && <GoFurtherRefresh />}
        <ExplainEnding
          buddy={buddy}
          deeper={<DeeperStart explanation={explanation} />}
          doneHref={getHomeHref(explanation)}
          explanation={explanation}
          questionHref={getGoalStartHref}
          result={{
            answered: slot.correctCount + slot.incorrectCount,
            celebration: slot.completion.result
              ? getLessonCelebration(slot.completion.result)
              : null,
            correct: slot.correctCount,
          }}
          saving={slot.completion.status === "saving"}
        />
      </>
    ),
  };
}

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

/** An old prefetched copy that still shows the wait follows the run, which reads the page again once ready. */
export function ExplainClient({
  explanation,
  hasSession,
  soundsEnabled,
  tutor,
  tutorSuggestions,
}: {
  explanation: ExplanationView;
  hasSession: boolean;
  soundsEnabled: boolean;
  tutor: TutorViewer;
  tutorSuggestions: readonly LessonTutorSuggestion[];
}) {
  const router = useRouter();

  const endingSlots = useMemo(
    () => createExplainEnding({ buddy: tutor.buddy, explanation }),
    [explanation, tutor.buddy],
  );

  const routing = useMemo(
    () => ({ exit: getHomeHref(explanation), exitTo: null, nextLesson: null }),
    [explanation],
  );

  const [phase, setPhase] = useState<"outline" | "playing">(() =>
    explanation.lesson ? "playing" : "outline",
  );

  useExplanationWait(Boolean(explanation.lesson));

  const { lesson } = explanation;
  const isWaiting = !lesson || phase === "outline";

  useEffect(() => {
    if (isWaiting) {
      preloadLessonPlayer();
    }
  }, [isWaiting]);

  const progress = useWorkflowRun({
    generationId: explanation.generationId,
    kind: "explanation",
    onReady: () => {
      if (!explanation.lesson) {
        router.refresh();
      }
    },
    restart: () => retryExplanationAction(explanation.goalId),
  });

  if (isWaiting) {
    return (
      <ExplainWaiting
        closeHref={getHomeHref(explanation)}
        deeper={<DeeperStart explanation={explanation} />}
        explanation={explanation}
        onCheck={() => router.refresh()}
        onRetry={() => retryExplanationAction(explanation.goalId)}
        // A transition keeps the outline on screen until the player's code is in.
        onStart={() => startTransition(() => setPhase("playing"))}
        progress={progress}
      />
    );
  }

  return (
    <LazyLessonPlayer
      endingSlots={endingSlots}
      firstAnswer={null}
      hasSession={hasSession}
      lesson={lesson}
      outline
      routing={routing}
      soundsEnabled={soundsEnabled}
      studySessionId={null}
      tutor={tutor}
      tutorSuggestions={tutorSuggestions}
    />
  );
}
