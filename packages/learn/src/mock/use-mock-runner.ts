"use client";

import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { settleWithin } from "@zoonk/utils/timeout";
import { useEffect, useEffectEvent, useState } from "react";
import { useLearnAnalytics } from "../learn-context";
import { type MockActions, type MockRunner, type MockStep } from "./mock-context";
import { useMockDrafts } from "./use-mock-drafts";

/**
 * Handing a section in and scoring the mock are database work of a second or two (no model
 * runs): past `slowMs` the screen says it's still at it, and past `timeoutMs` it stops waiting and
 * offers to try again, which is safe (a handed-in section stays handed in).
 */
const STEP_BOUNDS = { slowMs: 10_000, timeoutMs: 45_000 } as const;

/**
 * The started mock from the learner's side: answering and flagging (saved as drafts), moving
 * through the section, handing it in (or letting the clock do it) and seeing the result. Each step
 * takes the mock as the server returns it, so the screen always matches what's stored.
 */
export function useMockRunner({
  actions,
  initial,
}: {
  actions: MockActions;
  initial: MockView;
}): MockRunner {
  const analytics = useLearnAnalytics();
  const [view, setView] = useState(initial);
  const [position, setPosition] = useState(0);
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState<MockStep | null>(null);
  const [error, setError] = useState(false);
  const slow = useTakingLong({ active: busy !== null, afterMs: STEP_BOUNDS.slowMs });
  const drafts = useMockDrafts({ save: actions.answer, view: initial });
  const questions = view.current?.questions ?? [];
  const question = questions[position];
  const shownItemId = question?.itemId;

  // A question's clock starts when it appears, whether by moving to it or a new section.
  const showQuestion = useEffectEvent((itemId: string) => drafts.show(itemId));

  useEffect(() => {
    if (shownItemId) {
      showQuestion(shownItemId);
    }
  }, [shownItemId]);

  async function step(kind: MockStep, request: () => Promise<MockView | null>) {
    setPending(true);
    setBusy(kind);
    setError(false);

    if (question) {
      drafts.leave(question.itemId);
    }

    // Answers are saved first, then the step; a step that fails or takes too long says so.
    const settled = await settleWithin({
      ms: STEP_BOUNDS.timeoutMs,
      request: async () => {
        await drafts.flush();
        return request();
      },
    }).catch(() => null);

    const next = settled?.status === "settled" ? settled.value : null;
    setPending(false);
    setBusy(null);

    if (!next) {
      setError(true);
      return;
    }

    if (next.status === "finished" && view.status !== "finished" && next.result) {
      analytics.track({
        name: "Big Challenge Finished",
        properties: { correct: next.result.correct, questions: next.result.total },
      });
    }

    drafts.reset(next);
    setPosition(0);
    setView(next);
  }

  function go(target: number) {
    const clamped = Math.min(Math.max(0, target), Math.max(0, questions.length - 1));

    if (question && clamped !== position) {
      drafts.leave(question.itemId);
    }

    setPosition(clamped);
  }

  return {
    answer: (choice) => question && drafts.answer(question.itemId, choice),
    busy,
    drafts: drafts.drafts,
    error: error || drafts.failed,
    finish: () => step("finish", actions.finish),
    go,
    pending,
    position,
    slow,
    submitSection: () => step("submit", () => actions.submit(view.current?.section ?? 0)),
    toggleFlag: () => question && drafts.toggleFlag(question.itemId),
    view,
  };
}
