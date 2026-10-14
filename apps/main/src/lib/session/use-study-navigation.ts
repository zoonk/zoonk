"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { askToWriteLesson } from "@/lib/lessons/lesson-writing-request";
import { type MissionLinks } from "@zoonk/learn/buddy";
import { type LessonLimit } from "@zoonk/learn/help-limit";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useCallback, useMemo } from "react";
import { LESSON_LIMIT_PARAM, toLessonLimitParam } from "./lesson-limit-param";
import { SESSION_BLOCK_PARAM } from "./session-block-param";
import { SESSION_STOPPED_HREF } from "./session-stopped-param";
import { type StudyDestination } from "./study-destination";
import {
  addExtraStudyBlockAction,
  openMissionAction,
  openNextStudyBlockAction,
  openStudyBlockAction,
  openWrittenLessonAction,
  stopStudySessionAction,
} from "./study-session-actions";

const SESSION_PATH = "/session";

type SessionScreen = {
  /** The block the learner opened, which the screen shows. */
  blockId?: string;
  /** Why the lesson can't be written now, when the learner's tap was refused. */
  limit: LessonLimit | null;
  reason?: "plusRequired" | "setAside";
};

function getSessionHref({ blockId, limit, reason }: SessionScreen) {
  const params = new URLSearchParams();

  if (limit) {
    params.set(LESSON_LIMIT_PARAM, toLessonLimitParam(limit));
  } else if (reason) {
    params.set("writing", reason);
  }

  if (blockId) {
    params.set(SESSION_BLOCK_PARAM, blockId);
  }

  const query = params.toString();
  return query ? (`${SESSION_PATH}?${query}` as const) : SESSION_PATH;
}

/**
 * Opens the session screen on the block the learner opened: in place when it's already open (it
 * re-reads itself, so a question block that follows another one simply appears), with why the
 * lesson can't be written when the learner's tap was refused, and without it once a later tap
 * went through.
 */
function useOpenSession() {
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (screen: SessionScreen) => {
      const href = getSessionHref(screen);

      if (pathname !== SESSION_PATH) {
        router.push(href);
      } else if (href === SESSION_PATH + globalThis.location.search) {
        router.refresh();
      } else {
        router.replace(href);
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
        const openedFrom = globalThis.location.pathname + globalThis.location.search;
        const answer = await askToWriteLesson(destination.lessonId);

        if (
          answer.status === "failed" ||
          openedFrom !== globalThis.location.pathname + globalThis.location.search
        ) {
          return false;
        }

        openSession({
          blockId: destination.blockId,
          limit: answer.status === "refused" ? answer.limit : null,
          reason:
            answer.status === "plusRequired" || answer.status === "setAside"
              ? answer.status
              : undefined,
        });
      } else if (destination.kind === "lesson") {
        router.push(`/learn/${destination.lessonId}?session=${destination.sessionId}`);
      } else if (destination.kind === "challenge") {
        router.push(`/challenge/${destination.planItemId}?session=${destination.sessionId}`);
      } else if (destination.kind === "checkpoint") {
        router.push(`/checkpoint/${destination.blockId}?session=${destination.sessionId}`);
      } else if (destination.kind === "mock") {
        router.push(`/mock/${destination.blockId}?session=${destination.sessionId}`);
      } else if (destination.kind === "essay") {
        router.push(`/essay/${destination.blockId}`);
      } else if (destination.kind === "today") {
        router.push("/today");
      } else {
        openSession({ blockId: destination.blockId, limit: null });
      }

      return true;
    },
    [openSession, router],
  );
}

/**
 * Runs an action that opens a block, then goes where it's played, unless the learner moved on
 * meanwhile. Resolves to whether it went.
 */
function useOpenDestination() {
  const go = useGoToStudyDestination();

  return useCallback(
    async (action: () => Promise<StudyDestination | null>): Promise<boolean> => {
      const openedFrom = globalThis.location.pathname + globalThis.location.search;
      const destination = await action();

      return openedFrom === globalThis.location.pathname + globalThis.location.search
        ? go(destination)
        : false;
    },
    [go],
  );
}

/**
 * Where today's missions and a new learner's first steps open, from their chips on Today and their
 * rows in the buddy's day: one of the day's blocks, started like any block the learner picks, or
 * the page where the rest is done. A call opens its unit's page and a question the buddy's tab,
 * where the learner starts it.
 */
export function useMissionLinks(goalId: string): MissionLinks {
  const navigate = useOpenDestination();
  const router = useRouter();

  return useMemo(
    () => ({
      hrefs: {
        areaPractice: (areaId) => `/content/chapters/${areaId}`,
        buddy: "/buddy",
        call: (chapterId) => `/content/units/${chapterId}`,
        mistakesPractice: "/mistakes/practice",
        mockChooser: "/mock/new",
        pattern: (patternId) => `/pattern/${patternId}`,
        pronunciation: `/pronunciation?goal=${goalId}`,
      },
      // A block that didn't open was read before the day changed: the page it was tapped on reads
      // itself again, so the chip or row shows where it stands now.
      openBlock: async (blockId) => {
        const openedFrom = globalThis.location.pathname + globalThis.location.search;

        const opened = await navigate(() =>
          openMissionAction({ blockId, timeZone: getLocalTimeZone() }),
        );

        if (!opened && openedFrom === globalThis.location.pathname + globalThis.location.search) {
          router.refresh();
        }

        return opened;
      },
    }),
    [goalId, navigate, router],
  );
}

/**
 * Moves through today's session: each action opens where the next block is played. Stopping for
 * today shows what changed so far on the session screen; the rest waits on Today.
 */
export function useStudyNavigation(sessionId: string) {
  const navigate = useOpenDestination();
  const router = useRouter();

  const input = useCallback(() => ({ sessionId, timeZone: getLocalTimeZone() }), [sessionId]);

  return {
    addExtraTime: () => navigate(() => addExtraStudyBlockAction(input())),
    continueSession: () => navigate(() => openNextStudyBlockAction(input())),
    openBlock: (blockId: string) => navigate(() => openStudyBlockAction({ ...input(), blockId })),
    openWrittenLesson: (blockId: string) =>
      navigate(() => openWrittenLessonAction({ ...input(), blockId })),
    stop: async () => {
      const stopped = await stopStudySessionAction(input());

      if (stopped) {
        router.push(SESSION_STOPPED_HREF);
      }

      return stopped;
    },
  };
}
