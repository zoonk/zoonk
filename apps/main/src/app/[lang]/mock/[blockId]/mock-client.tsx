"use client";

import { MainAskTutor } from "@/components/learn/main-ask-tutor";
import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { type MockActions, MockScreen } from "@zoonk/learn/mock";
import { type LearnBuddy } from "@zoonk/learn/navigation";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useMemo } from "react";
import {
  moveChallengeAction,
  undoChallengeMoveAction,
} from "../../checkpoint/[blockId]/checkpoint-actions";
import {
  finishMockAction,
  saveMockAnswerAction,
  startMockAction,
  submitMockSectionAction,
} from "./mock-actions";

/**
 * Wires the mock screen to its actions in the learner's timezone. Once done it continues where the
 * page says (back to the session it was opened from, or Today), or to practicing its mistakes, and
 * the learner can ask the tutor about the result.
 */
export function MockClient({
  canAsk,
  continueHref,
  mock,
  buddy,
}: {
  canAsk: boolean;
  continueHref: string;
  mock: MockView;
  buddy: LearnBuddy | null;
}) {
  const { blockId } = mock;
  const target = useMemo(() => ({ blockId, kind: "mock" as const }), [blockId]);

  const actions = useMemo<MockActions>(
    () => ({
      answer: (input) => saveMockAnswerAction(blockId, input),
      finish: () => finishMockAction(blockId, getLocalTimeZone()),
      move: () => moveChallengeAction(blockId, getLocalTimeZone()),
      start: () => startMockAction(blockId, getLocalTimeZone()),
      submit: (section) => submitMockSectionAction(blockId, section, getLocalTimeZone()),
      undoMove: (changeId) => undoChallengeMoveAction({ blockId, changeId }, getLocalTimeZone()),
    }),
    [blockId],
  );

  const hrefs = useMemo(
    () => ({ continue: continueHref, exit: "/today", mistakes: "/mistakes/practice" }),
    [continueHref],
  );

  return (
    <MockScreen
      actions={actions}
      ask={<MainAskTutor canAsk={canAsk} target={target} />}
      hrefs={hrefs}
      mock={mock}
      buddy={buddy}
    />
  );
}
