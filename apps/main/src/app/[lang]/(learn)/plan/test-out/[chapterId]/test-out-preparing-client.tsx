"use client";

import { useRouter } from "@/i18n/navigation";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { type GenerationRun } from "@zoonk/learn/generation/run";
import { TestOutPreparing } from "@zoonk/learn/test-out/preparing";
import { useState, useTransition } from "react";
import { type TestOutWriting, requestTestOutWriting } from "./test-out-writing";

type TestOutPage = { backHref: string; chapterId: string; chapterTitle: string; goalId: string };

/** A start the API refused to run or couldn't be reached for: it says so at once, with a retry. */
function notStartedRun(retry: () => void): GenerationRun {
  return { failure: "notStarted", retry, status: "failed", steps: {} };
}

/**
 * Follows the run writing the questions, until the page shows the test. "Try again" after a failed
 * run asks for the questions once more.
 */
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
      backHref={page.backHref}
      chapterTitle={page.chapterTitle}
      limit={null}
      onStart={() => run.retry?.()}
      run={run}
      starting={false}
    />
  );
}

/**
 * A chapter's test-out with no questions yet: the learner asks for them, follows them being
 * written, and the page shows the test once they exist.
 */
export function TestOutPreparingClient(page: TestOutPage) {
  const router = useRouter();
  const [writing, setWriting] = useState<TestOutWriting | null>(null);
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
      backHref={page.backHref}
      chapterTitle={page.chapterTitle}
      limit={writing?.status === "refused" ? writing.limit : null}
      onStart={start}
      run={writing?.status === "failed" && !isPending ? notStartedRun(start) : null}
      starting={isPending || writing?.status === "ready"}
    />
  );
}
