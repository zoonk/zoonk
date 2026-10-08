"use client";

import { useRouter } from "@/i18n/navigation";
import { type TestOutStart } from "@zoonk/learn/chapter";
import { useCallback } from "react";
import { TEST_OUT_FROM_SESSION_PARAM, TEST_OUT_RUN_PARAM } from "./test-out-params";
import { requestTestOutWriting } from "./test-out-writing";

/**
 * "Take the test" on a chapter's or unit's page, or offered in today's session (`fromSession`):
 * asks for the test-out's questions (a POST on the learner's tap) and opens the test, which
 * follows the run writing them when they don't exist yet.
 */
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
      const writing = await requestTestOutWriting({ chapterId, goalId });

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
