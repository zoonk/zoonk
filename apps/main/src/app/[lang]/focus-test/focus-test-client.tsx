"use client";

import { decidePlanChangeAction } from "@/app/[lang]/(app)/(learn)/plan/journey-actions";
import { SessionCeremony } from "@/components/learn/session-ceremony";
import { useRouter } from "@/i18n/navigation";
import { type QuestionWriting, requestQuestionWriting } from "@/lib/questions/question-writing";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { type LearnBuddy } from "@zoonk/learn/buddy-name";
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
  goalParam: string | null;
  goalId: string;
};

function requestFocusTestWriting(goalId: string): Promise<QuestionWriting> {
  return requestQuestionWriting(`/goals/${encodeURIComponent(goalId)}/plan/focus-test/generations`);
}

function getTestHref({ page, run }: { page: FocusTestPage; run: string | null }) {
  const query = new URLSearchParams([
    ...(page.goalParam ? [[FOCUS_TEST_GOAL_PARAM, page.goalParam]] : []),
    run ? [FOCUS_TEST_RUN_PARAM, run] : [FOCUS_TEST_STARTED_PARAM, "1"],
  ]).toString();

  return `/focus-test?${query}` as const;
}

function notStartedRun(retry: () => void): GenerationRun {
  return { failure: "notStarted", retry, status: "failed", steps: {} };
}

function WritingFocusTest({
  buddy,
  generationId,
  page,
  test,
}: {
  buddy: LearnBuddy;
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
      buddy={buddy}
      closeHref={page.closeHref}
      doneHref={page.doneHref}
      onSubmit={submitFocusTestAction.bind(null, page.goalId)}
      onUndo={(changeId) => decidePlanChangeAction(page.goalId, { changeId, status: "undone" })}
      preparing={{ limit: null, onStart: () => run.retry?.(), run: shown, starting: false }}
      renderCeremony={(milestone, onClose) => (
        <SessionCeremony buddy={buddy} milestone={milestone} onClose={onClose} />
      )}
      started
      test={test}
    />
  );
}

export function FocusTestClient({
  buddy,
  generationId,
  page,
  started,
  test,
}: {
  buddy: LearnBuddy;
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

  // The same tree while the run's questions arrive, so the answers given meanwhile stay.
  if (runId) {
    return <WritingFocusTest buddy={buddy} generationId={runId} page={page} test={test} />;
  }

  return (
    <FocusTestScreen
      buddy={buddy}
      closeHref={page.closeHref}
      doneHref={page.doneHref}
      onSubmit={submitFocusTestAction.bind(null, page.goalId)}
      onUndo={(changeId) => decidePlanChangeAction(page.goalId, { changeId, status: "undone" })}
      renderCeremony={(milestone, onClose) => (
        <SessionCeremony buddy={buddy} milestone={milestone} onClose={onClose} />
      )}
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
