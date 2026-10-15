"use client";

import { useRefreshAfterAppWrites } from "@/lib/http/app-writes";
import { postToApp } from "@/lib/http/post-to-app";
import { finishStudyBlockAction } from "@/lib/session/study-session-actions";
import { useStudyNavigation } from "@/lib/session/use-study-navigation";
import { type EssayDraft, type EssayView } from "@zoonk/core/exams/essays/contract";
import { type EssayActions, EssayScreen } from "@zoonk/learn/essay";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useRef } from "react";

const HREFS = { exit: "/today" };

type Submission = Promise<EssayDraft | "limitReached" | null>;

/**
 * The writing screen wired to grading, and Continue to finishing the block and the session. Every
 * draft still being graded (the learner skipped the rewrite meanwhile, or the screen stopped
 * waiting for it) is recorded before the block is finished, so the block counts it. A draft sent
 * again while its earlier send is still out joins that request instead of sending another.
 */
export function EssayClient({ essay }: { essay: EssayView }) {
  const navigation = useStudyNavigation(essay.sessionId);
  useRefreshAfterAppWrites();
  const grading = useRef<Promise<unknown>>(Promise.resolve());
  const sending = useRef(new Map<string, Submission>());
  const ids = { blockId: essay.blockId, sessionId: essay.sessionId };

  const actions: EssayActions = {
    finish: async () => {
      await grading.current;
      const outcome = await finishStudyBlockAction({ ...ids, timeZone: getLocalTimeZone() });
      return outcome.status === "finished" && (await navigation.continueSession());
    },
    submit: (input) => {
      const sent = sending.current.get(input.attemptId);

      if (sent) {
        return sent;
      }

      const request: Submission = postToApp({
        body: { ...input, timeZone: getLocalTimeZone() },
        path: `/api/essays/${encodeURIComponent(essay.blockId)}/submissions`,
      });

      sending.current.set(input.attemptId, request);
      void request.then(() => sending.current.delete(input.attemptId));
      grading.current = Promise.allSettled([grading.current, request]);
      return request;
    },
  };

  return <EssayScreen actions={actions} essay={essay} hrefs={HREFS} />;
}
