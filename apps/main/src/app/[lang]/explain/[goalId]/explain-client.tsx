"use client";

import { useRouter } from "@/i18n/navigation";
import { useRefreshWhenOld } from "@/lib/learn/use-refresh-when-old";
import { recordGenerationWaitAction } from "@/lib/lessons/generation-wait-action";
import { getCourseStartHref, getGoalStartHref } from "@/lib/public/public-hrefs";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { type ExplanationView } from "@zoonk/core/view-models/explain/contract";
import { ExplainEnding } from "@zoonk/learn/explain/ending";
import { ExplainDeeperLink, ExplainWaiting } from "@zoonk/learn/explain/waiting";
import { useExtracted, useLocale } from "next-intl";
import { type ComponentProps, startTransition, useEffect, useMemo, useRef, useState } from "react";
import { retryExplanationAction } from "./explain-actions";
import { LazyLessonPlayer, preloadLessonPlayer } from "./lazy-lesson-player";

type EndingSlots = NonNullable<ComponentProps<typeof LazyLessonPlayer>["endingSlots"]>;

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

/**
 * The explanation's title as words inside a sentence: "how inflation works" for "How
 * inflation works", leaving an acronym ("GDP") as it is.
 */
function toTopic(title: string): string {
  const topic = title.trim().replace(/[?!.]+$/u, "");
  const isAcronym = /^\p{Lu}{2}/u.test(topic);

  return isAcronym ? topic : topic.charAt(0).toLocaleLowerCase() + topic.slice(1);
}

/**
 * "I want to learn this in depth": the Overview course's start page, which asks the learner's
 * level before anything is created, or, before a course is linked (or when the subject has none),
 * onboarding with the topic as the goal, said as the learner would say it ("I want to understand
 * how inflation works in depth").
 */
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
 * and the check in the lesson player, with the outline beside them on a wide screen, ending with
 * "Now you know" and "Want to go further?". A learner who waited sees the finished outline first
 * and starts it with "See explanation". Opened from an old prefetched copy (Today's link), it
 * reads itself again, so an explanation written meanwhile shows.
 */
export function ExplainClient({
  explanation,
  hasSession,
  readAt,
  soundsEnabled,
}: {
  explanation: ExplanationView;
  hasSession: boolean;
  /** When the page's private reads ran (`getReadAt`). */
  readAt: number;
  soundsEnabled: boolean;
}) {
  const router = useRouter();
  useRefreshWhenOld(readAt);
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

  const { lesson } = explanation;
  const isWaiting = !lesson || phase === "outline";

  // The player loads while the learner waits, so the explanation opens at once when it's ready.
  useEffect(() => {
    if (isWaiting) {
      preloadLessonPlayer();
    }
  }, [isWaiting]);

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
    />
  );
}
