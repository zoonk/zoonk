"use client";

import { decidePlanChangeAction } from "@/app/[lang]/(learn)/journey/journey-actions";
import { useRouter } from "@/i18n/navigation";
import { type QuestionWriting, requestQuestionWriting } from "@/lib/questions/question-writing";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { FocusTestScreen, type FocusTestView, isFocusTestComplete } from "@zoonk/learn/focus-test";
import { type GenerationRun } from "@zoonk/learn/generation/run";
import { useState, useTransition } from "react";
import { submitFocusTestAction } from "./focus-test-actions";
import {
  FOCUS_TEST_GOAL_PARAM,
  FOCUS_TEST_RUN_PARAM,
  FOCUS_TEST_STARTED_PARAM,
} from "./focus-test-params";

type FocusTestPage = {
  closeHref: string;
  doneHref: string;
  /** Set when the test is for another goal than the switcher's, kept on the page's address. */
  goalParam: string | null;
  goalId: string;
};

function requestFocusTestWriting(goalId: string): Promise<QuestionWriting> {
  return requestQuestionWriting(`/goals/${encodeURIComponent(goalId)}/plan/focus-test/generations`);
}

/** The page's address with the test started, or following the run writing its questions. */
function getTestHref({ page, run }: { page: FocusTestPage; run: string | null }) {
  const query = new URLSearchParams([
    ...(page.goalParam ? [[FOCUS_TEST_GOAL_PARAM, page.goalParam]] : []),
    run ? [FOCUS_TEST_RUN_PARAM, run] : [FOCUS_TEST_STARTED_PARAM, "1"],
  ]).toString();

  return `/focus-test?${query}` as const;
}

/** A start the API refused to run or couldn't be reached for: it says so at once, with a retry. */
function notStartedRun(retry: () => void): GenerationRun {
  return { failure: "notStarted", retry, status: "failed", steps: {} };
}

/**
 * The test the learner started with a run writing the questions it lacked. The questions that
 * exist are asked meanwhile, and the page reads the rest once the run is ready, keeping the
 * answers given (the run counts as going on until it has them); a test without any opens once
 * they're written.
 */
function WritingFocusTest({
  generationId,
  page,
  test,
}: {
  generationId: string;
  page: FocusTestPage;
  test: FocusTestView;
}) {
  const router = useRouter();
  const [isReading, startReading] = useTransition();
  const showWritten = () => startReading(() => router.refresh());

  const run = useWorkflowRun({
    generationId,
    kind: "focusTestQuestions",
    onReady: showWritten,
    restart: async () => {
      const writing = await requestFocusTestWriting(page.goalId);

      if (writing.status === "ready") {
        showWritten();
      }

      return writing.status === "writing" ? writing.generationId : null;
    },
  });

  const shown: GenerationRun = isReading ? { ...run, status: "following" } : run;

  return (
    <FocusTestScreen
      closeHref={page.closeHref}
      doneHref={page.doneHref}
      onSubmit={submitFocusTestAction.bind(null, page.goalId)}
      onUndo={(changeId) => decidePlanChangeAction(page.goalId, { changeId, status: "undone" })}
      preparing={{ limit: null, onStart: () => run.retry?.(), run: shown, starting: false }}
      started
      test={test}
    />
  );
}

/**
 * The focus test for one goal. Its questions are asked when they all exist; otherwise the
 * learner's Start asks for the missing ones (a POST, never on page load) and the page follows the
 * run writing them while it asks the ones that exist, or, without any, opens once they're written.
 */
export function FocusTestClient({
  generationId,
  page,
  started,
  test,
}: {
  generationId: string | null;
  page: FocusTestPage;
  started: boolean;
  test: FocusTestView;
}) {
  const router = useRouter();
  const [writing, setWriting] = useState<QuestionWriting | null>(null);
  const [isPending, startTransition] = useTransition();
  const runId = writing?.status === "writing" ? writing.generationId : generationId;

  const start = () =>
    startTransition(async () => {
      const result = await requestFocusTestWriting(page.goalId);

      if (result.status === "ready") {
        router.replace(getTestHref({ page, run: null }));
      }

      if (result.status === "writing") {
        router.replace(getTestHref({ page, run: result.generationId }));
      }

      setWriting(result);
    });

  // Once started with a run, the page keeps this tree while the run's questions arrive, so the
  // answers given meanwhile stay.
  if (runId) {
    return <WritingFocusTest generationId={runId} page={page} test={test} />;
  }

  return (
    <FocusTestScreen
      closeHref={page.closeHref}
      doneHref={page.doneHref}
      onSubmit={submitFocusTestAction.bind(null, page.goalId)}
      onUndo={(changeId) => decidePlanChangeAction(page.goalId, { changeId, status: "undone" })}
      preparing={
        isFocusTestComplete(test)
          ? null
          : {
              limit: writing?.status === "refused" ? writing.limit : null,
              onStart: start,
              run: writing?.status === "failed" && !isPending ? notStartedRun(start) : null,
              starting: isPending || writing?.status === "ready",
            }
      }
      started={started}
      test={test}
    />
  );
}
