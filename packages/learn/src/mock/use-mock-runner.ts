"use client";

import { type MockAnswer } from "@zoonk/core/exams/mocks/answer-contract";
import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { settleWithin } from "@zoonk/utils/timeout";
import { useEffect, useEffectEvent, useState } from "react";
import { useLearnAnalytics } from "../learn-context";
import { useIsSectionExpired } from "./mock-clock";
import {
  type MockActions,
  type MockEssayGradingStatus,
  type MockPlayOutcome,
  type MockRunner,
  type MockStep,
} from "./mock-context";
import { isSavedQuestionExpired } from "./mock-deadline";
import { getSectionMoves } from "./section-moves";
import { isDraftAnswered, useMockDrafts } from "./use-mock-drafts";

/** A retry after the timeout is safe: a handed-in section stays handed in. */
const STEP_BOUNDS = { slowMs: 10_000, timeoutMs: 45_000 } as const;

/** Essays grade at once, about 9 to 17 s each and up to 24 s on the fallback model. */
const ESSAY_GRADING_TIMEOUT_MS = 120_000;

function isSameAnswer(first: MockAnswer | null, second: MockAnswer | null): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

function hasPendingEssays(view: MockView): boolean {
  return view.essays.some((essay) => essay.status === "pending");
}

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

function useEssayGrading({
  actions,
  setView,
}: {
  actions: MockActions;
  setView: (view: MockView) => void;
}) {
  const [essayGrading, setEssayGrading] = useState<MockEssayGradingStatus>("idle");

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

  return { essayGrading, gradeEssays };
}

function hasExpiredFinalQuestion(view: MockView): boolean {
  const current = view.current;

  const navigation = view.sections.find(
    (section) => section.index === current?.section,
  )?.navigation;

  return isSavedQuestionExpired({
    drafts: current?.drafts ?? [],
    itemId: current?.questions.at(-1)?.itemId,
    seconds: navigation?.itemSeconds ?? null,
  });
}

function useShownQuestion({
  currentItemId,
  drafts,
  forwardOnly,
  shownItemId,
}: {
  currentItemId?: string;
  drafts: ReturnType<typeof useMockDrafts>;
  forwardOnly: boolean;
  shownItemId?: string;
}) {
  const synchronize = useEffectEvent((itemId: string | undefined) => {
    if (itemId) {
      drafts.show(itemId);

      if (forwardOnly) {
        drafts.visit(itemId);
      }

      return;
    }

    if (currentItemId) {
      drafts.leave(currentItemId);
    }
  });

  useEffect(() => synchronize(shownItemId), [shownItemId]);
}

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
  const [reached, setReached] = useState(initial.current?.resume ?? 0);
  const [changed, setChanged] = useState<readonly number[]>([]);
  const [pending, setPending] = useState(false);
  const [questionTimeUp, setQuestionTimeUp] = useState(() => hasExpiredFinalQuestion(initial));
  const sectionTimeUp = useIsSectionExpired(view.current?.deadline);
  const timeUp = sectionTimeUp || questionTimeUp;
  const [busy, setBusy] = useState<MockStep | null>(null);
  const [error, setError] = useState(false);
  const { essayGrading, gradeEssays } = useEssayGrading({ actions, setView });
  const slow = useTakingLong({ active: busy !== null, afterMs: STEP_BOUNDS.slowMs });
  const drafts = useMockDrafts({ save: actions.answer, view: initial });
  const questions = view.current?.questions ?? [];
  const question = questions[position];
  const shownItemId = timeUp ? undefined : question?.itemId;
  const changesLeft = view.current?.changesLeft ?? null;

  const moves = getSectionMoves({
    answered: Boolean(question && isDraftAnswered(drafts.drafts[question.itemId])),
    changed,
    changesLeft: changesLeft === null ? null : Math.max(0, changesLeft - changed.length),
    navigation: view.sections.find((section) => section.status === "current")?.navigation ?? null,
    position,
    reached,
    total: questions.length,
  });

  useShownQuestion({
    currentItemId: question?.itemId,
    drafts,
    forwardOnly: moves.forwardOnly,
    shownItemId,
  });

  async function step(kind: MockStep, request: () => Promise<MockView | null>) {
    setPending(true);
    setBusy(kind);
    setError(false);

    if (question) {
      drafts.leave(question.itemId);
    }

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
    setQuestionTimeUp(false);
    setView(next);

    if (
      (kind === "submit" || kind === "finish") &&
      next.status === "finished" &&
      view.status !== "finished" &&
      hasPendingEssays(next)
    ) {
      void gradeEssays();
    }
  }

  function move(target: number, timedOut: boolean) {
    if (pending || timeUp || (timedOut && moves.itemSeconds === null)) {
      return;
    }

    if (timedOut && target === questions.length) {
      setQuestionTimeUp(true);
      return;
    }

    if (!(timedOut ? moves.canOpenAfterTimeout(target) : moves.canOpen(target))) {
      return;
    }

    if (question && target !== position) {
      drafts.leave(question.itemId);
    }

    setPosition(target);
    setReached((current) => Math.max(current, target));
  }

  function canAnswer(next: MockAnswer | null): boolean {
    if (!question || timeUp || !moves.canChange(position)) {
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
    error,
    essayGrading,
    finish: () => step("finish", actions.finish),
    go: (target) => move(target, false),
    gradeEssays,
    moves,
    pending,
    play: (setId) => countPlay({ play: actions.play, setId, setView }),
    position,
    retrySaves: drafts.retry,
    saveStatus: drafts.saveStatus,
    savesInFlight: drafts.inFlight,
    slow,
    startSpeaking: () => step("startSpeaking", actions.startSpeaking),
    submitSection: () => step("submit", () => actions.submit(view.current?.section ?? 0)),
    timeOutQuestion: () => move(position + 1, true),
    timeUp,
    toggleFlag: () => question && drafts.toggleFlag(question.itemId),
    view,
    write: (next) => {
      if (question && canAnswer(next)) {
        drafts.write(question.itemId, next);
      }
    },
  };
}
