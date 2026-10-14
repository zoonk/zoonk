"use client";

import { useRouter } from "@/i18n/navigation";
import { MOCK_ENTRY_HREFS } from "@/lib/mocks/mock-entry-hrefs";
import { type QuestionWriting, requestQuestionWriting } from "@/lib/questions/question-writing";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { type MockOptionsView } from "@zoonk/core/exams/mocks/contract";
import {
  MockChooserScreen,
  type MockChooserStatus,
  type MockStart,
  getMockOptionKey,
} from "@zoonk/learn/mock/chooser";
import { safeAsync } from "@zoonk/utils/error";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useState, useTransition } from "react";
import { type MockStartOutcome, startAnytimeMockAction } from "./mock-start-actions";

/** While the goal's skill map is still drawn (a goal in onboarding), the page asks again this often. */
const PREPARING_RETRY_MS = 3000;

/** Enough tries to cover a skill map that takes a minute or two. */
const PREPARING_TRIES = 60;

type ChooserPage = {
  goalId: string;
  /** A diagnostic mock as placement, in onboarding; otherwise the mocks to pick from. */
  placement: boolean;
};

/** The mock picked, as the start and question-writing requests name it. */
function toChoice(start: MockStart) {
  if (start.purpose === "placement") {
    return { length: start.length, purpose: "placement" as const };
  }

  const { area, day, kind } = start.option;
  return { purpose: "practice" as const, shape: { area, day, kind } };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Asks for the mock's questions, waiting while the skill map is still drawn. */
async function requestMockWriting({
  page,
  start,
}: {
  page: ChooserPage;
  start: MockStart;
}): Promise<QuestionWriting> {
  const path = `/goals/${encodeURIComponent(page.goalId)}/mocks/generations`;

  const ask = async (tries: number): Promise<QuestionWriting> => {
    // A request that never answers reads as a failed one, as a refused start does.
    const { data: writing } = await safeAsync(() => requestQuestionWriting(path, toChoice(start)));

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

/** The picked option's key, for a mock that can ask only part of its questions now. */
function getStartKey(start: MockStart): string | null {
  return start.purpose === "practice" ? getMockOptionKey(start.option) : null;
}

/** Why the mock didn't open: it can ask only part of its questions now, or it couldn't start. */
function toStatus({ outcome, start }: { outcome: MockStartOutcome; start: MockStart }) {
  const optionKey = getStartKey(start);

  if (outcome.status === "short" && optionKey) {
    const { examQuestions, limit, minutes, questions } = outcome;
    return { examQuestions, kind: "short", limit, minutes, optionKey, questions } as const;
  }

  return outcome.status === "notEnoughQuestions"
    ? ({ kind: "failed", reason: "notEnoughQuestions" } as const)
    : ({ kind: "failed", reason: "failed" } as const);
}

/** The chooser while a run writes the picked mock's questions; it starts the mock once they're in. */
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

type Writing = { generationId: string; start: MockStart };

/**
 * Wires the mocks to pick from (or the placement mock) to their actions in the learner's timezone:
 * Start runs the mock and opens it; a bank short of its questions has them written first (the
 * page follows the run), then the mock starts with what there is. `bar` is the chooser page's bar,
 * with the way back to where it was opened.
 */
export function MockChooserClient({
  bar,
  page,
  view,
}: {
  bar: React.ReactNode;
  page: ChooserPage;
  view: MockOptionsView;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [status, setStatus] = useState<MockChooserStatus>({ kind: "choosing" });
  const [writing, setWriting] = useState<Writing | null>(null);

  /**
   * A start the server couldn't answer (a busy server's transaction that never began, a dropped
   * connection) is a failed start: the chooser says so with Start ready again, never an error page.
   */
  const startMock = async ({
    acceptFewer,
    start,
  }: {
    acceptFewer: boolean;
    start: MockStart;
  }): Promise<MockStartOutcome> => {
    const { data: outcome } = await safeAsync(() =>
      startAnytimeMockAction(page.goalId, {
        ...toChoice(start),
        acceptFewer,
        timeZone: getLocalTimeZone(),
      }),
    );

    return outcome ?? { status: "failed" };
  };

  const open = ({ outcome, start }: { outcome: MockStartOutcome; start: MockStart }) => {
    if ("id" in outcome) {
      router.push(`/mock/${outcome.id}`);
      return;
    }

    setWriting(null);
    setStatus(toStatus({ outcome, start }));
  };

  // The bank holds what it can now: the mock starts with the questions there are.
  const startWithWhatThereIs = async (start: MockStart) =>
    open({ outcome: await startMock({ acceptFewer: true, start }), start });

  const write = async (start: MockStart) => {
    const result = await requestMockWriting({ page, start });

    if (result.status === "writing") {
      setWriting({ generationId: result.generationId, start });
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

    await startWithWhatThereIs(start);
  };

  const begin = (start: MockStart) =>
    startTransition(async () => {
      // Start again on a mock the screen said is short takes it as it is.
      const acceptFewer = status.kind === "short" && status.optionKey === getStartKey(start);
      setStatus({ kind: "choosing" });
      const outcome = await startMock({ acceptFewer, start });

      if (outcome.status === "needsQuestions") {
        await write(start);
        return;
      }

      open({ outcome, start });
    });

  const screen = {
    bar,
    busy,
    hrefs: { mock: MOCK_ENTRY_HREFS.mock, plus: "/subscription" },
    onStart: begin,
    placement: page.placement,
    view,
  };

  if (!writing) {
    return <MockChooserScreen {...screen} status={status} />;
  }

  return (
    <WritingMock
      generationId={writing.generationId}
      onReady={() => startTransition(() => startWithWhatThereIs(writing.start))}
      restart={async () => {
        const again = await requestMockWriting({ page, start: writing.start });
        return again.status === "writing" ? again.generationId : null;
      }}
      screen={screen}
    />
  );
}
