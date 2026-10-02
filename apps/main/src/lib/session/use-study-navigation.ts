"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { askToWriteLesson } from "@/lib/lessons/lesson-writing-request";
import { type LessonLimit } from "@zoonk/learn/help-limit";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useCallback } from "react";
import { LESSON_LIMIT_PARAM, toLessonLimitParam } from "./lesson-limit-param";
import { type StudyDestination } from "./study-destination";
import {
  addExtraStudyBlockAction,
  openNextStudyBlockAction,
  openStudyBlockAction,
  stopStudySessionAction,
} from "./study-session-actions";

const SESSION_PATH = "/session";

/**
 * Opens the session screen: in place when it's already open (it re-reads itself, so a question
 * block that follows another one simply appears), with why the next lesson can't be written when
 * the learner's tap was refused, and without it once a later tap went through.
 */
function useOpenSession() {
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (limit: LessonLimit | null) => {
      const href = limit
        ? (`${SESSION_PATH}?${LESSON_LIMIT_PARAM}=${toLessonLimitParam(limit)}` as const)
        : SESSION_PATH;

      if (pathname !== SESSION_PATH) {
        router.push(href);
      } else if (limit || globalThis.location.search) {
        router.replace(href);
      } else {
        router.refresh();
      }
    },
    [pathname, router],
  );
}

/**
 * Opens where a block of today's session is played. A lesson that isn't written yet is asked for
 * from here, on the learner's tap, so the API's answer (a run to follow, or why not now) reaches
 * the session screen that shows it.
 */
export function useGoToStudyDestination() {
  const router = useRouter();
  const openSession = useOpenSession();

  return useCallback(
    async (destination: StudyDestination | null): Promise<boolean> => {
      if (!destination) {
        return false;
      }

      if (destination.kind === "unwrittenLesson") {
        const answer = await askToWriteLesson(destination.lessonId);
        openSession(answer.status === "refused" ? answer.limit : null);
      } else if (destination.kind === "lesson") {
        router.push(`/learn/${destination.lessonId}?session=${destination.sessionId}`);
      } else if (destination.kind === "checkpoint") {
        router.push(`/checkpoint/${destination.blockId}?session=${destination.sessionId}`);
      } else if (destination.kind === "mock") {
        router.push(`/mock/${destination.blockId}?session=${destination.sessionId}`);
      } else if (destination.kind === "essay") {
        router.push(`/essay/${destination.blockId}`);
      } else if (destination.kind === "today") {
        router.push("/today");
      } else {
        openSession(null);
      }

      return true;
    },
    [openSession, router],
  );
}

/** Moves through today's session: each action opens where the next block is played. */
export function useStudyNavigation(sessionId: string) {
  const go = useGoToStudyDestination();

  const input = useCallback(() => ({ sessionId, timeZone: getLocalTimeZone() }), [sessionId]);

  return {
    addExtraTime: async () => go(await addExtraStudyBlockAction(input())),
    continueSession: async () => go(await openNextStudyBlockAction(input())),
    openBlock: async (blockId: string) => go(await openStudyBlockAction({ ...input(), blockId })),
    stop: async () => {
      const stopped = await stopStudySessionAction(input());
      return stopped && go({ kind: "session" });
    },
  };
}
