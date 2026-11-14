"use client";

import { useRouter } from "@/i18n/navigation";
import { MOCK_ENTRY_HREFS } from "@/lib/mocks/mock-entry-hrefs";
import { type QuestionWriting, requestQuestionWriting } from "@/lib/questions/question-writing";
import { answerHere, openingHere } from "@/lib/session/tap-answer";
import { useResetWhenDone } from "@/lib/use-reset-when-done";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { type MockOptionView, type MockOptionsView } from "@zoonk/core/exams/mocks/contract";
import {
  MockChooserScreen,
  type MockChooserStatus,
  getMockOptionKey,
} from "@zoonk/learn/mock/chooser";
import { useStillMounted } from "@zoonk/ui/hooks/still-here";
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
  isWanted,
  option,
}: {
  goalId: string;
  isWanted: () => boolean;
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
    return isWanted() ? ask(tries - 1) : writing;
  };

  return ask(PREPARING_TRIES);
}

function toStatus({ option, outcome }: { option: MockOptionView; outcome: MockStartOutcome }) {
  if (outcome.status === "short") {
    const { examQuestions, minutes, questions } = outcome;
    const availableAt = outcome.availableAt?.toISOString() ?? null;
    const optionKey = getMockOptionKey(option);
    const limit = outcome.limit ?? null;

    return {
      availableAt,
      examQuestions,
      kind: "short",
      limit,
      minutes,
      optionKey,
      questions,
    } as const;
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

type Here = () => Promise<boolean>;

type MockChooserClientProps = { bar: React.ReactNode; goalId: string; view: MockOptionsView };

function MockChooserVisit({
  bar,
  goalId,
  onDone,
  view,
}: MockChooserClientProps & { onDone: () => void }) {
  const router = useRouter();
  const isMounted = useStillMounted();
  const [busy, startTransition] = useTransition();
  const [status, setStatus] = useState<MockChooserStatus>({ kind: "choosing" });
  const [writing, setWriting] = useState<Writing | null>(null);

  /** A start the server couldn't answer is a failed start, never an error page. */
  const startMock = async ({
    here,
    option,
    ...flags
  }: {
    acceptFewer?: boolean;
    afterWriting?: boolean;
    here: Here;
    option: MockOptionView;
  }): Promise<MockStartOutcome | null> => {
    const { data } = await safeAsync(() =>
      answerHere(startAnytimeMockAction(goalId, { ...toChoice(option), ...flags }), here),
    );

    const answered = data ?? "failed";

    if (answered === "left") {
      return null;
    }

    return answered === "failed" ? { status: "failed" } : answered.answer;
  };

  const open = ({ option, outcome }: { option: MockOptionView; outcome: MockStartOutcome }) => {
    if ("id" in outcome) {
      router.push(`/mock/${outcome.id}`);
      return;
    }

    setWriting(null);
    setStatus(toStatus({ option, outcome }));
  };

  const startWith = async (
    option: MockOptionView,
    here: Here,
    flags: { acceptFewer?: boolean; afterWriting?: boolean },
  ) => {
    const outcome = await startMock({ ...flags, here, option });

    if (outcome) {
      open({ option, outcome });
    }
  };

  /** What was written may still leave the mock short: the server then answers `short`, to ask first. */
  const startAfterWriting = (option: MockOptionView, here: Here) =>
    startWith(option, here, { afterWriting: true });

  const write = async (option: MockOptionView, here: Here) => {
    const { data } = await safeAsync(() =>
      answerHere(requestMockWriting({ goalId, isWanted: isMounted, option }), here),
    );

    const asked = data ?? "failed";

    if (asked === "left") {
      return;
    }

    const result: QuestionWriting = asked === "failed" ? { status: "failed" } : asked.answer;

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

    await startAfterWriting(option, here);
  };

  const begin = (option: MockOptionView) =>
    startTransition(async () => {
      onDone();
      const here = openingHere();
      setStatus({ kind: "choosing" });
      const outcome = await startMock({ here, option });

      if (outcome?.status === "needsQuestions") {
        await write(option, here);
      } else if (outcome) {
        open({ option, outcome });
      }
    });

  const beginShort = (option: MockOptionView) =>
    startTransition(async () => {
      onDone();
      setStatus({ kind: "choosing" });
      await startWith(option, openingHere(), { acceptFewer: true });
    });

  const screen = {
    bar,
    busy,
    hrefs: { mock: MOCK_ENTRY_HREFS.mock },
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
      onReady={() => startTransition(() => startAfterWriting(writing.option, openingHere()))}
      restart={async () => {
        const again = await requestMockWriting({
          goalId,
          isWanted: isMounted,
          option: writing.option,
        });

        return again.status === "writing" ? again.generationId : null;
      }}
      screen={screen}
    />
  );
}

/** Back or a link shows this page as it was left, so a visit that started a mock starts over. */
export function MockChooserClient(props: MockChooserClientProps) {
  const reset = useResetWhenDone();
  return <MockChooserVisit key={reset.key} {...props} onDone={reset.done} />;
}
