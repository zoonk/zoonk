"use client";

import { useRouter } from "@/i18n/navigation";
import { answerHere, openingHere } from "@/lib/session/tap-answer";
import { type TestOutStart } from "@zoonk/learn/chapter";
import { useCallback } from "react";
import { TEST_OUT_FROM_SESSION_PARAM, TEST_OUT_RUN_PARAM } from "./test-out-params";
import { requestTestOutWriting } from "./test-out-writing";

export function useStartTestOut() {
  const router = useRouter();

  return useCallback(
    async ({
      chapterId,
      fromSession = false,
      goalId,
    }: {
      chapterId: string;
      fromSession?: boolean;
      goalId: string;
    }): Promise<TestOutStart> => {
      const asked = await answerHere(requestTestOutWriting({ chapterId, goalId }), openingHere());

      if (typeof asked === "string") {
        return { status: asked === "left" ? "started" : "failed" };
      }

      const writing = asked.answer;

      if (writing.status === "refused") {
        return writing;
      }

      if (writing.status === "failed") {
        return { status: "failed" };
      }

      const query = new URLSearchParams([
        ...(writing.status === "writing" ? [[TEST_OUT_RUN_PARAM, writing.generationId]] : []),
        ...(fromSession ? [[TEST_OUT_FROM_SESSION_PARAM, "1"]] : []),
      ]).toString();

      router.push(query ? `/test-out/${chapterId}?${query}` : `/test-out/${chapterId}`);

      return { status: "started" };
    },
    [router],
  );
}
