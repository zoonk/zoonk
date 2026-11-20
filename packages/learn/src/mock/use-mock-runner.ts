"use client";

import { type MockAnswer } from "@zoonk/core/exams/mocks/answer-contract";
import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { type MockDraft } from "@zoonk/core/exams/mocks/view-contract";
import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { settleWithin } from "@zoonk/utils/timeout";
import { useEffect, useEffectEvent, useState } from "react";
import { isDraftAnswered } from "./mock-answer-progress";
import { useIsSectionExpired } from "./mock-clock";
import {
  type MockActions,
  type MockEssayGradingStatus,
  type MockPlayOutcome,
  type MockRunner,
  type MockStep,
} from "./mock-context";
import { isSavedQuestionExpired } from "./mock-deadline";
import {
  getChangedAfterAnswer,
  getChargedPositions,
  getCurrentSectionMoves,
  replayKeptAnswers,
} from "./section-moves";
import { useMockDrafts } from "./use-mock-drafts";
import { useSpeakingStart } from "./use-speaking-start";

/** A retry after the timeout is safe: a handed-in section stays handed in. */
const STEP_BOUNDS = { slowMs: 10_000, timeoutMs: 45_000 } as const;

/** Essays grade at once, about 9 to 17 s each and up to 24 s on the fallback model. */
const ESSAY_GRADING_TIMEOUT_MS = 120_000;

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
  const [gradesUsedOn, setGradesUsedOn] = useState<string | null>(null);

  // The day's essay grades come back at the learner's midnight.
  useEffect(() => {
    if (gradesUsedOn === null) {
      return;
    }

    function offerGradingOnANewDay() {
      if (document.visibilityState === "visible" && new Date().toDateString() !== gradesUsedOn) {
        setGradesUsedOn(null);
        setEssayGrading("idle");
      }
    }

    document.addEventListener("visibilitychange", offerGradingOnANewDay);
    return () => document.removeEventListener("visibilitychange", offerGradingOnANewDay);
  }, [gradesUsedOn]);

  async function gradeEssays() {
    const askedOn = new Date().toDateString();
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
    setGradesUsedOn(outcome.status === "limitReached" ? askedOn : null);
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
  const [view, setView] = useState(initial);
  const [position, setPosition] = useState(initial.current?.resume ?? 0);
  const [reached, setReached] = useState(initial.current?.resume ?? 0);
  const [changed, setChanged] = useState<readonly number[]>(() => getChargedPositions(initial));
  const [pending, setPending] = useState(false);
  const [questionTimeUp, setQuestionTimeUp] = useState(() => hasExpiredFinalQuestion(initial));
  const sectionTimeUp = useIsSectionExpired(view.current?.deadline);
  const timeUp = sectionTimeUp || questionTimeUp;
  const [busy, setBusy] = useState<MockStep | null>(null);
  const [error, setError] = useState(false);
  const { essayGrading, gradeEssays } = useEssayGrading({ actions, setView });
  const speaking = useSpeakingStart({ start: actions.startSpeaking, step });
  const slow = useTakingLong({ active: busy !== null, afterMs: STEP_BOUNDS.slowMs });

  function enter(next: MockView, kept: readonly MockDraft[]) {
    const place = replayKeptAnswers({ kept, view: next });
    setPosition(place.reached);
    setReached(place.reached);
    setChanged(place.changed);
  }

  const drafts = useMockDrafts({ onEnter: enter, save: actions.answer, view });

  const questions = view.current?.questions ?? [];
  const question = questions[position];
  const shownItemId = timeUp ? undefined : question?.itemId;

  const moves = getCurrentSectionMoves({
    answered: Boolean(question && isDraftAnswered(drafts.drafts[question.itemId])),
    changed,
    position,
    reached,
    view,
  });

  useShownQuestion({
    currentItemId: question?.itemId,
    drafts,
    forwardOnly: moves.forwardOnly,
    shownItemId,
  });

  async function step(kind: MockStep, request: () => Promise<MockView | "writing" | null>) {
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

    if (next === null || next === "writing") {
      setError(next === null);
      return;
    }

    drafts.reset(next);
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
    if (!question || timeUp) {
      return false;
    }

    const nextChanged = getChangedAfterAnswer({
      answer: next,
      changed,
      moves,
      position,
      reached,
      saved: drafts.drafts[question.itemId]?.answer ?? null,
    });

    if (nextChanged === null) {
      return false;
    }

    setChanged(nextChanged);
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
    failedDrafts: drafts.failedDrafts,
    finish: () => step("finish", actions.finish),
    go: (target) => move(target, false),
    gradeEssays,
    moves,
    pending,
    play: (setId) => countPlay({ play: actions.play, setId, setView }),
    position,
    retrySaves: drafts.retry,
    saveStatus: drafts.saveStatus,
    savedDrafts: drafts.savedDrafts,
    savesInFlight: drafts.inFlight,
    slow,
    speakingWriting: speaking.speakingWriting,
    startSpeaking: speaking.startSpeaking,
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
