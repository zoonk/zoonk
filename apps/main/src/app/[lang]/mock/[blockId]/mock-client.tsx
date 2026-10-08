"use client";

import { MainAskTutor, type TutorViewer } from "@/components/learn/main-ask-tutor";
import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { type MockActions, MockScreen } from "@zoonk/learn/mock";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useMemo } from "react";
import {
  adaptPlanFromMockAction,
  finishMockAction,
  saveMockAnswerAction,
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
  const target = useMemo(() => ({ blockId, kind: "mock" as const }), [blockId]);

  const actions = useMemo<MockActions>(
    () => ({
      adapt: (offer) => adaptPlanFromMockAction(blockId, offer, getLocalTimeZone()),
      answer: (input) => saveMockAnswerAction(blockId, input),
      finish: () => finishMockAction(blockId, getLocalTimeZone()),
      submit: (section) => submitMockSectionAction(blockId, section, getLocalTimeZone()),
    }),
    [blockId],
  );

  // A placement mock leaves for onboarding, where stopping it keeps what was answered.
  const exit = mock.purpose === "placement" ? continueHref : "/today";

  const hrefs = useMemo(
    () => ({ continue: continueHref, exit, mistakes: "/mistakes/practice" }),
    [continueHref, exit],
  );

  return (
    <MockScreen
      actions={actions}
      ask={<MainAskTutor {...tutor} target={target} />}
      hrefs={hrefs}
      mock={mock}
    />
  );
}
