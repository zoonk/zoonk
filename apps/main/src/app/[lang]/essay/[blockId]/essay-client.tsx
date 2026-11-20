"use client";

import { useRouter } from "@/i18n/navigation";
import {
  saveWritingDraftFromBrowser,
  startWritingFromBrowser,
} from "@/lib/essays/writing-requests";
import { postToApp } from "@/lib/http/post-to-app";
import { finishStudyBlockAction } from "@/lib/session/study-session-actions";
import { useStudyNavigation } from "@/lib/session/use-study-navigation";
import {
  type EssayDraft,
  type EssayView,
  type WrittenEssayDraft,
} from "@zoonk/core/exams/essays/contract";
import { type EssayActions, EssayScreen } from "@zoonk/learn/essay";
import { type WritingActions, WritingScreen } from "@zoonk/learn/writing";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useRef } from "react";

const HREFS = { exit: "/today" };

type Outcome = EssayDraft | WrittenEssayDraft | "limitReached" | "signUpRequired" | null;

function isWritten(draft: EssayDraft | WrittenEssayDraft): draft is WrittenEssayDraft {
  return "kind" in draft.grade;
}

/**
 * Every draft still being graded is recorded before the block is finished, so the block counts it.
 * A draft sent again while its earlier send is out joins that request.
 */
function useEssayRequests(essay: EssayView) {
  const navigation = useStudyNavigation(essay.sessionId);
  const router = useRouter();
  const grading = useRef<Promise<unknown>>(Promise.resolve());
  const sending = useRef(new Map<string, Promise<Outcome>>());
  const ids = { blockId: essay.blockId, sessionId: essay.sessionId };

  const finish = async () => {
    await grading.current;
    const outcome = await finishStudyBlockAction({ ...ids, timeZone: getLocalTimeZone() });
    return outcome.status === "finished" && (await navigation.continueSession());
  };

  const submit = (input: {
    admissionId?: string;
    attemptId: string;
    durationMs: number;
    text: string;
  }) => {
    const sent = sending.current.get(input.attemptId);

    if (sent) {
      return sent;
    }

    const request: Promise<Outcome> = postToApp<Outcome | "blockNotActive">({
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

    sending.current.set(input.attemptId, request);
    void request.then(() => sending.current.delete(input.attemptId));
    grading.current = Promise.allSettled([grading.current, request]);
    return request;
  };

  return { finish, submit };
}

export function EssayClient({ essay }: { essay: EssayView }) {
  const { finish, submit } = useEssayRequests(essay);
  const { writing } = essay;

  if (writing) {
    const actions: WritingActions = {
      finish,
      saveDraft: (draft) => saveWritingDraftFromBrowser({ blockId: essay.blockId, draft }),
      start: async ({ previousAttemptId }) => {
        const answer = await startWritingFromBrowser({ blockId: essay.blockId, previousAttemptId });
        return answer === "notWriting" ? { status: "failed" } : answer;
      },
      submit: async (input) => {
        const result = await submit(input);

        if (result === null || typeof result === "string") {
          return result;
        }

        return isWritten(result) ? result : null;
      },
    };

    return <WritingScreen actions={actions} essay={{ ...essay, writing }} hrefs={HREFS} />;
  }

  const actions: EssayActions = {
    finish,
    submit: async (input) => {
      const result = await submit(input);
      return result !== null && typeof result === "object" && isWritten(result) ? null : result;
    },
  };

  return <EssayScreen actions={actions} essay={essay} hrefs={HREFS} />;
}
