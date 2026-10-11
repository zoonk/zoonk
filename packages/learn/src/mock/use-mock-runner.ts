"use client";

import { type MockAnswer } from "@zoonk/core/exams/mocks/answer-contract";
import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { settleWithin } from "@zoonk/utils/timeout";
import { useEffect, useEffectEvent, useState } from "react";
import { useLearnAnalytics } from "../learn-context";
import {
  type MockActions,
  type MockEssayGradingStatus,
  type MockPlayOutcome,
  type MockRunner,
  type MockStep,
} from "./mock-context";
import { getSectionMoves } from "./section-moves";
import { useMockDrafts } from "./use-mock-drafts";

/**
 * Handing a section in and scoring the mock are database work of a second or two (no model
 * runs): past `slowMs` the screen says it's still at it, and past `timeoutMs` it stops waiting and
 * offers to try again, which is safe (a handed-in section stays handed in).
 */
const STEP_BOUNDS = { slowMs: 10_000, timeoutMs: 45_000 } as const;

/**
 * Grading essays takes about 9 to 17 seconds each (a fallback model up to 24 s), at once for a
 * mock's few; past this the screen stops waiting and offers to grade them again.
 */
const ESSAY_GRADING_TIMEOUT_MS = 120_000;

function isSameAnswer(first: MockAnswer | null, second: MockAnswer | null): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

function hasPendingEssays(view: MockView): boolean {
  return view.essays.some((essay) => essay.status === "pending");
}

/** The mock with a recording's plays as the server counted them. */
function withPlayed({
  outcome,
  setId,
  view,
}: {
  outcome: MockPlayOutcome;
  setId: string;
  view: MockView;
}): MockView {
  if (!view.current) {
    return view;
  }

  const others = view.current.plays.filter((plays) => plays.setId !== setId);
  const plays = [...others, { played: outcome.played, setId }];
  return { ...view, current: { ...view.current, plays } };
}

/**
 * Counts a recording's play on the mock as it starts, keeping the server's count on screen: false
 * when the mock had none left, so the recording stops. A play the server couldn't count keeps
 * going: the page still counts it.
 */
async function countPlay({
  play,
  setId,
  setView,
}: {
  play: MockActions["play"];
  setId: string;
  setView: (update: (view: MockView) => MockView) => void;
}): Promise<boolean> {
  const outcome = await play(setId).catch(() => null);

  if (!outcome) {
    return true;
  }

  setView((view) => withPlayed({ outcome, setId, view }));
  return outcome.status === "counted";
}

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
  const [position, setPosition] = useState(initial.current?.resume ?? 0);
  // The furthest question opened, and the questions the review changed, in the running section.
  const [reached, setReached] = useState(initial.current?.resume ?? 0);
  const [changed, setChanged] = useState<readonly number[]>([]);
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState<MockStep | null>(null);
  const [error, setError] = useState(false);
  const [essayGrading, setEssayGrading] = useState<MockEssayGradingStatus>("idle");
  const slow = useTakingLong({ active: busy !== null, afterMs: STEP_BOUNDS.slowMs });
  const drafts = useMockDrafts({ save: actions.answer, view: initial });
  const questions = view.current?.questions ?? [];
  const question = questions[position];
  const shownItemId = question?.itemId;
  const changesLeft = view.current?.changesLeft ?? null;

  const moves = getSectionMoves({
    changed,
    changesLeft: changesLeft === null ? null : Math.max(0, changesLeft - changed.length),
    navigation: view.sections.find((section) => section.status === "current")?.navigation ?? null,
    reached,
    total: questions.length,
  });

  // A question's clock starts when it appears, whether by moving to it or a new section.
  const showQuestion = useEffectEvent((itemId: string) => {
    drafts.show(itemId);

    if (moves.forwardOnly) {
      drafts.visit(itemId);
    }
  });

  useEffect(() => {
    if (shownItemId) {
      showQuestion(shownItemId);
    }
  }, [shownItemId]);

  async function gradeEssays() {
    setEssayGrading("grading");

    const settled = await settleWithin({
      ms: ESSAY_GRADING_TIMEOUT_MS,
      request: actions.gradeEssays,
    }).catch(() => null);

    const outcome = settled?.status === "settled" ? settled.value : null;

    if (!outcome) {
      setEssayGrading("failed");
      return;
    }

    setView(outcome.mock);
    setEssayGrading(outcome.status === "limitReached" ? "limitReached" : "idle");
  }

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
    setPosition(next.current?.resume ?? 0);
    setReached(next.current?.resume ?? 0);
    setChanged([]);
    setView(next);

    // Handing the mock in grades its essays right away, while the objective result shows.
    if (next.status === "finished" && view.status !== "finished" && hasPendingEssays(next)) {
      void gradeEssays();
    }
  }

  function go(target: number) {
    const clamped = Math.min(Math.max(0, target), Math.max(0, questions.length - 1));

    if (!moves.canOpen(clamped)) {
      return;
    }

    if (question && clamped !== position) {
      drafts.leave(question.itemId);
    }

    setPosition(clamped);
    setReached((current) => Math.max(current, clamped));
  }

  /**
   * Whether the current question's answer may become this one. In a forward-only section's
   * review, changing a left-behind answer uses one of its changes, once per question.
   */
  function canAnswer(next: MockAnswer | null): boolean {
    if (!question || !moves.canChange(position)) {
      return false;
    }

    const saved = drafts.drafts[question.itemId]?.answer ?? null;
    const isChange = moves.reviewing && position < reached && !isSameAnswer(saved, next);

    if (isChange && !changed.includes(position)) {
      setChanged((current) => [...current, position]);
    }

    return true;
  }

  function answer(next: MockAnswer | null) {
    if (question && canAnswer(next)) {
      drafts.answer(question.itemId, next);
    }
  }

  return {
    answer,
    busy,
    drafts: drafts.drafts,
    endBreak: () => step("endBreak", actions.endBreak),
    error: error || drafts.failed,
    essayGrading,
    finish: () => step("finish", actions.finish),
    go,
    gradeEssays,
    moves,
    pending,
    play: (setId) => countPlay({ play: actions.play, setId, setView }),
    position,
    savesInFlight: drafts.inFlight,
    slow,
    startSpeaking: () => step("startSpeaking", actions.startSpeaking),
    submitSection: () => step("submit", () => actions.submit(view.current?.section ?? 0)),
    toggleFlag: () => question && drafts.toggleFlag(question.itemId),
    view,
    write: (next) => {
      if (question && canAnswer(next)) {
        drafts.write(question.itemId, next);
      }
    },
  };
}
