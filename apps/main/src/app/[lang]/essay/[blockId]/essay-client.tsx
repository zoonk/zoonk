"use client";

import { finishStudyBlockAction } from "@/lib/session/study-session-actions";
import { useStudyNavigation } from "@/lib/session/use-study-navigation";
import { type EssayView } from "@zoonk/core/exams/essays/contract";
import { type EssayActions, EssayScreen } from "@zoonk/learn/essay";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { submitEssayAction } from "./essay-actions";

const HREFS = { exit: "/today" };

/** The writing screen wired to grading, and Continue to finishing the block and the session. */
export function EssayClient({ essay }: { essay: EssayView }) {
  const navigation = useStudyNavigation(essay.sessionId);
  const ids = { blockId: essay.blockId, sessionId: essay.sessionId };

  const actions: EssayActions = {
    finish: async () => {
      const outcome = await finishStudyBlockAction({ ...ids, timeZone: getLocalTimeZone() });
      return outcome.status === "finished" && (await navigation.continueSession());
    },
    submit: (input) => submitEssayAction(essay.blockId, { ...input, timeZone: getLocalTimeZone() }),
  };

  return <EssayScreen actions={actions} essay={essay} hrefs={HREFS} />;
}
