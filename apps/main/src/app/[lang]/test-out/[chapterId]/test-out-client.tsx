"use client";

import { decidePlanChangeAction } from "@/app/[lang]/(app)/(learn)/plan/journey-actions";
import { SessionCeremony } from "@/components/learn/session-ceremony";
import { useRouter } from "@/i18n/navigation";
import { type QuestionWriting } from "@/lib/questions/question-writing";
import { TEST_OUT_RESULT_PARAM, TEST_OUT_RUN_PARAM } from "@/lib/test-out/test-out-params";
import { requestTestOutWriting } from "@/lib/test-out/test-out-writing";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { type LearnBuddy } from "@zoonk/learn/buddy-name";
import { type GenerationRun } from "@zoonk/learn/generation/run";
import { type TestOutRecord, TestOutRun, type TestOutTest } from "@zoonk/learn/test-out";
import { TestOutPreparing } from "@zoonk/learn/test-out/preparing";
import { useState, useTransition } from "react";
import { submitTestOutAction } from "./test-out-actions";

type TestOutPage = { chapterId: string; chapterTitle: string; closeHref: string; goalId: string };

function notStartedRun(retry: () => void): GenerationRun {
  return { failure: "notStarted", retry, status: "failed", steps: {} };
}

/** Cache invalidation re-renders this address, which must find the saved result instead of redirecting away. */
function showResultInAddress(requestId: string) {
  const query = new URLSearchParams(globalThis.location.search);
  query.delete(TEST_OUT_RUN_PARAM);
  query.set(TEST_OUT_RESULT_PARAM, requestId);
  globalThis.history.replaceState(null, "", `?${query.toString()}`);
}

export function TestOutClient({
  buddy,
  lessonsLeft,
  page,
  recorded,
  test,
}: {
  buddy: LearnBuddy;
  lessonsLeft: number | null;
  page: TestOutPage;
  recorded: TestOutRecord | null;
  test: TestOutTest | null;
}) {
  const target = { chapterId: page.chapterId, goalId: page.goalId };

  return (
    <TestOutRun
      buddy={buddy}
      chapterTitle={page.chapterTitle}
      closeHref={page.closeHref}
      draftKey={`test-out:${page.goalId}:${page.chapterId}`}
      lessonsLeft={lessonsLeft}
      onSubmit={async (input) => {
        showResultInAddress(input.requestId);
        return submitTestOutAction(target, input);
      }}
      onUndo={(changeId) => decidePlanChangeAction(page.goalId, { changeId, status: "undone" })}
      recorded={recorded}
      renderCeremony={(milestone, onClose) => (
        <SessionCeremony buddy={buddy} milestone={milestone} onClose={onClose} />
      )}
      test={test}
    />
  );
}

function WritingTestOut({ generationId, page }: { generationId: string; page: TestOutPage }) {
  const router = useRouter();
  const target = { chapterId: page.chapterId, goalId: page.goalId };

  const run = useWorkflowRun({
    generationId,
    kind: "testOutQuestions",
    onReady: () => router.refresh(),
    restart: async () => {
      const writing = await requestTestOutWriting(target);

      if (writing.status === "ready") {
        router.refresh();
      }

      return writing.status === "writing" ? writing.generationId : null;
    },
  });

  return (
    <TestOutPreparing
      chapterTitle={page.chapterTitle}
      closeHref={page.closeHref}
      limit={null}
      onStart={() => run.retry?.()}
      run={run}
      starting={false}
    />
  );
}

export function TestOutPreparingClient({
  generationId,
  page,
  plusRequired = false,
}: {
  generationId: string | null;
  page: TestOutPage;
  plusRequired?: boolean;
}) {
  const router = useRouter();

  const [writing, setWriting] = useState<QuestionWriting | null>(
    generationId ? { generationId, status: "writing" } : null,
  );

  const [isPending, startTransition] = useTransition();

  const start = () =>
    startTransition(async () => {
      const result = await requestTestOutWriting({
        chapterId: page.chapterId,
        goalId: page.goalId,
      });

      if (result.status === "ready") {
        router.refresh();
      }

      setWriting(result);
    });

  if (writing?.status === "writing") {
    return <WritingTestOut generationId={writing.generationId} page={page} />;
  }

  return (
    <TestOutPreparing
      chapterTitle={page.chapterTitle}
      closeHref={page.closeHref}
      limit={writing?.status === "refused" ? writing.limit : null}
      onStart={start}
      plusRequired={plusRequired || writing?.status === "plusRequired"}
      run={writing?.status === "failed" && !isPending ? notStartedRun(start) : null}
      starting={isPending || writing?.status === "ready"}
    />
  );
}
