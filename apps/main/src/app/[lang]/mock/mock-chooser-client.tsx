"use client";

import { useRouter } from "@/i18n/navigation";
import { type QuestionWriting, requestQuestionWriting } from "@/lib/questions/question-writing";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { type MockOptionsView } from "@zoonk/core/exams/mocks/contract";
import {
  MockChooserScreen,
  type MockChooserStatus,
  type MockStart,
} from "@zoonk/learn/mock/chooser";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useState, useTransition } from "react";
import { type MockStartOutcome, startAnytimeMockAction } from "./mock-start-actions";

/** While the goal's skill map is still drawn (a goal in onboarding), the page asks again this often. */
const PREPARING_RETRY_MS = 3000;

/** Enough tries to cover a skill map that takes a minute or two. */
const PREPARING_TRIES = 60;

type ChooserPage = {
  exitHref: string;
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
    const writing = await requestQuestionWriting(path, toChoice(start));

    if (writing.status !== "preparing" || tries <= 1) {
      return writing;
    }

    await wait(PREPARING_RETRY_MS);
    return ask(tries - 1);
  };

  return ask(PREPARING_TRIES);
}

function toFailure(outcome: MockStartOutcome): MockChooserStatus {
  if (outcome.status === "dailyLimitReached") {
    return { kind: "failed", reason: "dailyLimit" };
  }

  return outcome.status === "notEnoughQuestions"
    ? { kind: "failed", reason: "notEnoughQuestions" }
    : { kind: "failed", reason: "failed" };
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
 * screen follows the run), then the mock starts with what there is.
 */
export function MockChooserClient({ page, view }: { page: ChooserPage; view: MockOptionsView }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [status, setStatus] = useState<MockChooserStatus>({ kind: "choosing" });
  const [writing, setWriting] = useState<Writing | null>(null);

  const startMock = ({ acceptFewer, start }: { acceptFewer: boolean; start: MockStart }) =>
    startAnytimeMockAction(page.goalId, {
      ...toChoice(start),
      acceptFewer,
      timeZone: getLocalTimeZone(),
    });

  const open = (outcome: MockStartOutcome) => {
    if ("id" in outcome) {
      router.push(`/mock/${outcome.id}`);
      return;
    }

    setWriting(null);
    setStatus(toFailure(outcome));
  };

  // The bank holds what it can now: the mock starts with the questions there are.
  const startWithWhatThereIs = async (start: MockStart) =>
    open(await startMock({ acceptFewer: true, start }));

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
      setStatus({ kind: "choosing" });
      const outcome = await startMock({ acceptFewer: false, start });

      if (outcome.status === "needsQuestions") {
        await write(start);
        return;
      }

      open(outcome);
    });

  const screen = {
    busy,
    hrefs: { exit: page.exitHref, plus: "/subscription" },
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
