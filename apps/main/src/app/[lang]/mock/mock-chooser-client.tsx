"use client";

import { useRouter } from "@/i18n/navigation";
import { MOCK_ENTRY_HREFS } from "@/lib/mocks/mock-entry-hrefs";
import { type QuestionWriting, requestQuestionWriting } from "@/lib/questions/question-writing";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { type MockOptionView, type MockOptionsView } from "@zoonk/core/exams/mocks/contract";
import {
  MockChooserScreen,
  type MockChooserStatus,
  getMockOptionKey,
} from "@zoonk/learn/mock/chooser";
import { safeAsync } from "@zoonk/utils/error";
import { useState, useTransition } from "react";
import { type MockStartOutcome, startAnytimeMockAction } from "./mock-start-actions";

const PREPARING_RETRY_MS = 3000;

const PREPARING_TRIES = 60;

function toChoice({ area, day, kind }: MockOptionView) {
  return { shape: { area, day, kind } };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function requestMockWriting({
  goalId,
  option,
}: {
  goalId: string;
  option: MockOptionView;
}): Promise<QuestionWriting> {
  const path: `/${string}` = `/goals/${encodeURIComponent(goalId)}/mocks/generations`;

  const ask = async (tries: number): Promise<QuestionWriting> => {
    const { data: writing } = await safeAsync(() => requestQuestionWriting(path, toChoice(option)));

    if (!writing) {
      return { status: "failed" };
    }

    if (writing.status !== "preparing" || tries <= 1) {
      return writing;
    }

    await wait(PREPARING_RETRY_MS);
    return ask(tries - 1);
  };

  return ask(PREPARING_TRIES);
}

function toStatus({ option, outcome }: { option: MockOptionView; outcome: MockStartOutcome }) {
  if (outcome.status === "short") {
    const { examQuestions, limit, minutes, questions } = outcome;
    const optionKey = getMockOptionKey(option);
    return { examQuestions, kind: "short", limit, minutes, optionKey, questions } as const;
  }

  return outcome.status === "notEnoughQuestions"
    ? ({ kind: "failed", reason: "notEnoughQuestions" } as const)
    : ({ kind: "failed", reason: "failed" } as const);
}

function WritingMock({
  generationId,
  onReady,
  restart,
  screen,
}: {
  generationId: string;
  onReady: () => void;
  restart: () => Promise<string | null>;
  screen: Omit<React.ComponentProps<typeof MockChooserScreen>, "status">;
}) {
  const run = useWorkflowRun({ generationId, kind: "mockQuestions", onReady, restart });

  return <MockChooserScreen {...screen} status={{ kind: "writing", run }} />;
}

type Writing = { generationId: string; option: MockOptionView };

export function MockChooserClient({
  bar,
  goalId,
  view,
}: {
  bar: React.ReactNode;
  goalId: string;
  view: MockOptionsView;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [status, setStatus] = useState<MockChooserStatus>({ kind: "choosing" });
  const [writing, setWriting] = useState<Writing | null>(null);

  /** A start the server couldn't answer is a failed start, never an error page. */
  const startMock = async ({
    option,
    ...flags
  }: {
    acceptFewer?: boolean;
    afterWriting?: boolean;
    option: MockOptionView;
  }): Promise<MockStartOutcome> => {
    const { data: outcome } = await safeAsync(() =>
      startAnytimeMockAction(goalId, { ...toChoice(option), ...flags }),
    );

    return outcome ?? { status: "failed" };
  };

  const open = ({ option, outcome }: { option: MockOptionView; outcome: MockStartOutcome }) => {
    if ("id" in outcome) {
      router.push(`/mock/${outcome.id}`);
      return;
    }

    setWriting(null);
    setStatus(toStatus({ option, outcome }));
  };

  /** What was written may still leave the mock short: the server then answers `short`, to ask first. */
  const startAfterWriting = async (option: MockOptionView) =>
    open({ option, outcome: await startMock({ afterWriting: true, option }) });

  const write = async (option: MockOptionView) => {
    const result = await requestMockWriting({ goalId, option });

    if (result.status === "writing") {
      setWriting({ generationId: result.generationId, option });
      return;
    }

    if (result.status === "refused") {
      setStatus({ kind: "refused", limit: result.limit });
      return;
    }

    if (result.status === "failed") {
      setStatus({ kind: "failed", reason: "failed" });
      return;
    }

    await startAfterWriting(option);
  };

  const begin = (option: MockOptionView) =>
    startTransition(async () => {
      setStatus({ kind: "choosing" });
      const outcome = await startMock({ option });

      if (outcome.status === "needsQuestions") {
        await write(option);
        return;
      }

      open({ option, outcome });
    });

  const beginShort = (option: MockOptionView) =>
    startTransition(async () => {
      setStatus({ kind: "choosing" });
      open({ option, outcome: await startMock({ acceptFewer: true, option }) });
    });

  const screen = {
    bar,
    busy,
    hrefs: { mock: MOCK_ENTRY_HREFS.mock, plus: "/subscription" },
    onStart: begin,
    onStartShort: beginShort,
    onStayChoosing: () => setStatus({ kind: "choosing" }),
    view,
  };

  if (!writing) {
    return <MockChooserScreen {...screen} status={status} />;
  }

  return (
    <WritingMock
      generationId={writing.generationId}
      onReady={() => startTransition(() => startAfterWriting(writing.option))}
      restart={async () => {
        const again = await requestMockWriting({ goalId, option: writing.option });
        return again.status === "writing" ? again.generationId : null;
      }}
      screen={screen}
    />
  );
}
