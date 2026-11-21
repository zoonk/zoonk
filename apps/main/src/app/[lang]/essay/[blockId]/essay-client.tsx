"use client";

import { useRouter } from "@/i18n/navigation";
import {
  saveWritingDraftFromBrowser,
  startWritingFromBrowser,
} from "@/lib/essays/writing-requests";
import { postToApp } from "@/lib/http/post-to-app";
import { finishStudyBlockAction } from "@/lib/session/study-session-actions";
import { useStudyNavigation } from "@/lib/session/use-study-navigation";
import { type EssayDraft, type EssayView } from "@zoonk/core/exams/essays/contract";
import { type WritingActions, WritingScreen } from "@zoonk/learn/writing";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useRef } from "react";

const HREFS = { exit: "/today" };

/**
 * Every answer still being graded is recorded before the block is finished, so the block counts
 * it. An answer sent again while its earlier send is out joins that request.
 */
export function EssayClient({ essay }: { essay: EssayView }) {
  const navigation = useStudyNavigation(essay.sessionId);
  const router = useRouter();
  const grading = useRef<Promise<unknown>>(Promise.resolve());
  const sending = useRef(new Map<string, Promise<EssayDraft | null>>());
  const ids = { blockId: essay.blockId, sessionId: essay.sessionId };

  const actions: WritingActions = {
    finish: async () => {
      await grading.current;
      const outcome = await finishStudyBlockAction({ ...ids, timeZone: getLocalTimeZone() });
      return outcome.status === "finished" && (await navigation.continueSession());
    },
    saveDraft: (draft, { keepalive }) =>
      saveWritingDraftFromBrowser({ blockId: essay.blockId, draft, keepalive }),
    start: async ({ previousAttemptId }) => {
      const answer = await startWritingFromBrowser({ blockId: essay.blockId, previousAttemptId });
      return answer === "notWriting" ? { status: "failed" } : answer;
    },
    submit: (input) => {
      const key = `${input.admissionId}:${input.text}`;
      const sent = sending.current.get(key);

      if (sent) {
        return sent;
      }

      const request = postToApp<EssayDraft | "blockNotActive">({
        body: { ...input, timeZone: getLocalTimeZone() },
        path: `/api/essays/${encodeURIComponent(essay.blockId)}/submissions`,
      }).then((result) => {
        if (result !== "blockNotActive") {
          return result;
        }

        // The block was finished or skipped elsewhere; reading it again shows it closed.
        router.refresh();
        return null;
      });

      sending.current.set(key, request);
      void request.then(() => sending.current.delete(key));
      grading.current = Promise.allSettled([grading.current, request]);
      return request;
    },
  };

  return <WritingScreen actions={actions} essay={essay} hrefs={HREFS} />;
}
