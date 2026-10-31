"use client";

import { MainAskTutor, type TutorViewer } from "@/components/learn/main-ask-tutor";
import { SessionCeremony } from "@/components/learn/session-ceremony";
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

export function MockClient({
  againHref,
  continueHref,
  mock,
  tutor,
}: {
  againHref: string;
  continueHref: string;
  mock: MockView;
  tutor: TutorViewer;
}) {
  const { blockId } = mock;
  const { bfcacheId, refresh } = useRouter();
  const target = useMemo(() => ({ blockId, kind: "mock" as const }), [blockId]);

  const actions = useMemo<MockActions>(
    () => ({
      adapt: (offer) => adaptPlanFromMockAction(blockId, offer, getLocalTimeZone()),
      answer: (input) => saveMockAnswerAction(blockId, input),
      endBreak: () => endMockBreakAction(blockId),
      finish: () => finishMockAction(blockId, getLocalTimeZone()),
      gradeEssays: () => gradeMockEssaysAction(blockId, getLocalTimeZone()),
      play: (setId) => recordMockPlayAction(blockId, setId),
      refresh: () => refresh(),
      startSpeaking: () => startMockSpeakingAction(blockId),
      submit: (section) => submitMockSectionAction(blockId, section, getLocalTimeZone()),
    }),
    [blockId, refresh],
  );

  const exit = mock.purpose === "placement" ? continueHref : "/today";

  // Practice brings mistakes back only from tomorrow, so the mock's are reviewed in the notebook.
  const hrefs = useMemo(
    () => ({
      again: againHref,
      continue: continueHref,
      exit,
      mistakes: "/mistakes",
      speakingTask: (conversationId: string) => `/conversation/${conversationId}?mock=${blockId}`,
    }),
    [againHref, blockId, continueHref, exit],
  );

  return (
    // A link or redirect back opens the mock as the server has it now; Back and forward keep the
    // screen as it was.
    <MockScreen
      actions={actions}
      ask={<MainAskTutor {...tutor} size="task" target={target} />}
      buddy={tutor.buddy}
      hrefs={hrefs}
      key={`${bfcacheId}:${mock.status === "expired"}`}
      mock={mock}
      renderCeremony={(milestone, onClose) => (
        <SessionCeremony buddy={tutor.buddy} milestone={milestone} onClose={onClose} />
      )}
    />
  );
}
