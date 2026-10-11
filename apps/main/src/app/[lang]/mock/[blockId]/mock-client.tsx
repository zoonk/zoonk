"use client";

import { MainAskTutor, type TutorViewer } from "@/components/learn/main-ask-tutor";
import { useRouter } from "@/i18n/navigation";
import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { type MockActions, MockScreen } from "@zoonk/learn/mock";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useMemo } from "react";
import {
  adaptPlanFromMockAction,
  endMockBreakAction,
  finishMockAction,
  gradeMockEssaysAction,
  recordMockPlayAction,
  saveMockAnswerAction,
  startMockSpeakingAction,
  submitMockSectionAction,
} from "./mock-actions";

/**
 * Wires the mock screen to its actions in the learner's timezone. Once done it continues where the
 * page says (back to the session it was opened from, or Today), or to practicing its mistakes, and
 * the learner can ask the tutor about the result.
 */
export function MockClient({
  continueHref,
  mock,
  tutor,
}: {
  continueHref: string;
  mock: MockView;
  /** Who asks and the buddy who answers (`getTutorViewer`). */
  tutor: TutorViewer;
}) {
  const { blockId } = mock;
  const { bfcacheId } = useRouter();
  const target = useMemo(() => ({ blockId, kind: "mock" as const }), [blockId]);

  const actions = useMemo<MockActions>(
    () => ({
      adapt: (offer) => adaptPlanFromMockAction(blockId, offer, getLocalTimeZone()),
      answer: (input) => saveMockAnswerAction(blockId, input),
      endBreak: () => endMockBreakAction(blockId),
      finish: () => finishMockAction(blockId, getLocalTimeZone()),
      gradeEssays: () => gradeMockEssaysAction(blockId, getLocalTimeZone()),
      play: (setId) => recordMockPlayAction(blockId, setId),
      startSpeaking: () => startMockSpeakingAction(blockId),
      submit: (section) => submitMockSectionAction(blockId, section, getLocalTimeZone()),
    }),
    [blockId],
  );

  // A placement mock leaves for onboarding, where stopping it keeps what was answered.
  const exit = mock.purpose === "placement" ? continueHref : "/today";

  // A speaking task's call comes back to the mock when it's over.
  const hrefs = useMemo(
    () => ({
      continue: continueHref,
      exit,
      mistakes: "/mistakes/practice",
      speakingTask: (conversationId: string) => `/conversation/${conversationId}?mock=${blockId}`,
    }),
    [blockId, continueHref, exit],
  );

  return (
    // Coming back by a link or redirect (a speaking task's call returns here) opens the mock as the
    // server has it now; the screen kept from before would miss the task just done. Back and
    // forward keep it as it was.
    <MockScreen
      actions={actions}
      ask={<MainAskTutor {...tutor} size="task" target={target} />}
      hrefs={hrefs}
      key={bfcacheId}
      mock={mock}
    />
  );
}
