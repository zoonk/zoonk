"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getLearnerGeneration } from "@/lib/learner/learner-store";
import { withLearnerWrite } from "@/lib/learner/learner-views";
import { LESSON_GENERATION_PARAM } from "@/lib/lessons/lesson-writing-href";
import { askToWriteLesson } from "@/lib/lessons/lesson-writing-request";
import { type DayBlockRef } from "@zoonk/core/sessions/day-block";
import { type MissionLinks } from "@zoonk/learn/buddy";
import { type LessonLimit } from "@zoonk/learn/help-limit";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useCallback, useMemo } from "react";
import { LESSON_LIMIT_PARAM, toLessonLimitParam } from "./lesson-limit-param";
import { SESSION_BLOCK_PARAM } from "./session-block-param";
import { SESSION_GOAL_PARAM } from "./session-goal-param";
import { SESSION_PREPARING_PARAM } from "./session-preparing-param";
import { SESSION_STOPPED_HREF, SESSION_STOPPED_PARAM } from "./session-stopped-param";
import { type StudyDestination } from "./study-destination";
import {
  addExtraStudyBlockAction,
  openMissionAction,
  openNextStudyBlockAction,
  openStudyBlockAction,
  openWrittenLessonAction,
  saveMissionDayAction,
  stopStudySessionAction,
} from "./study-session-actions";

export const SESSION_PATH = "/session";

/**
 * The session screen to show: the block the learner opened (`blockId`, which names its day), or the
 * goal whose day was shown when no saved block names it (`goalId`: a day not opened yet, or its
 * summary), with what the learner's request to write its lesson came to: why it can't be written
 * now, or the run writing it (`generationId`), which its wait follows.
 */
type SessionScreen = {
  blockId?: string;
  generationId?: string;
  goalId?: string;
  limit: LessonLimit | null;
  /** The tap asked to prepare a step whose lesson the plan hasn't picked yet. */
  preparing?: boolean;
  reason?: "plusRequired" | "setAside";
};

/** The session screen's address: a saved block names its day; otherwise the goal names it. */
export function getSessionHref({
  blockId,
  generationId,
  goalId,
  limit,
  preparing,
  reason,
}: SessionScreen) {
  const params = new URLSearchParams();

  if (limit) {
    params.set(LESSON_LIMIT_PARAM, toLessonLimitParam(limit));
  } else if (reason) {
    params.set("writing", reason);
  } else if (generationId) {
    params.set(LESSON_GENERATION_PARAM, generationId);
  } else if (preparing) {
    params.set(SESSION_PREPARING_PARAM, "1");
  }

  if (blockId) {
    params.set(SESSION_BLOCK_PARAM, blockId);
  } else if (goalId) {
    params.set(SESSION_GOAL_PARAM, goalId);
  }

  const query = params.toString();
  return query ? (`${SESSION_PATH}?${query}` as const) : SESSION_PATH;
}

/** Reads the screen again: its own view when it keeps one (`refresh`), or the whole page. */
function useReread(refresh?: () => void) {
  const router = useRouter();

  return useCallback(() => {
    if (refresh) {
      refresh();
    } else {
      router.refresh();
    }
  }, [refresh, router]);
}

/**
 * Where the tab is now, as the app's own hrefs name it (no locale prefix): to tell whether the
 * learner moved on while a tap was answered, in any language.
 */
export function getCurrentLocation(): string {
  const { pathname, search } = globalThis.location;
  const [, first = "", ...rest] = pathname.split("/");
  const localized = routing.locales.some((locale) => locale === first);

  return (localized ? `/${rest.join("/")}` : pathname) + search;
}

/**
 * A tap's step the session screen moves to (`blockId`) at a new address (`href`): its entry moves
 * with it, so the screen's frame draws that step busy until it arrives.
 */
type SessionAddress = { blockId?: string; href: string };

/**
 * Opens the session screen on the block the learner opened. On the session screen already, it
 * reads itself again in place, so what it shows stays until the block arrives (a new address would
 * draw the screen's frame first). Only why a lesson can't be written travels in the address, and,
 * for a tap whose entry draws its step meanwhile (`onAddress`), the block it opened when that isn't
 * the one the address names (the day's next step changed since the screen showed it).
 */
function useOpenSession() {
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (screen: SessionScreen, onAddress?: (address: SessionAddress) => void) => {
      const href = getSessionHref(screen);

      // Right after stopping (`?stopped`), the address shows what's done so far: keeping going
      // opens the block at its own address instead.
      const stopped = new URLSearchParams(globalThis.location.search).has(SESSION_STOPPED_PARAM);

      if (pathname !== SESSION_PATH) {
        router.push(href);
      } else if (
        stopped ||
        screen.limit ||
        screen.reason ||
        screen.generationId ||
        screen.preparing
      ) {
        onAddress?.({ blockId: screen.blockId, href });
        router.replace(href);
      } else if (onAddress && screen.blockId && href !== getCurrentLocation()) {
        onAddress({ blockId: screen.blockId, href });
        router.replace(href);
      } else {
        router.refresh();
      }
    },
    [pathname, router],
  );
}

/**
 * Asks for a lesson that isn't written yet, from the learner's tap, so the API's answer reaches the
 * session screen that shows it: the run to follow, or why not now. One written by then opens in
 * the player. False when the request didn't go through, or the learner moved on meanwhile.
 */
function useOpenUnwrittenLesson() {
  const router = useRouter();
  const openSession = useOpenSession();

  return useCallback(
    async (
      destination: Extract<StudyDestination, { kind: "unwrittenLesson" }>,
      onSessionAddress?: (address: SessionAddress) => void,
    ): Promise<boolean> => {
      const openedFrom = getCurrentLocation();
      const generation = getLearnerGeneration();
      const answer = await askToWriteLesson(destination.lessonId);

      const stillHere = () =>
        openedFrom === getCurrentLocation() && generation === getLearnerGeneration();

      // The learner moved on, or someone else holds the session now: nothing here is theirs.
      if (answer.status === "failed" || !stillHere()) {
        return false;
      }

      // Written by the time the request answered: it opens in the player, as a wait that sees it
      // written does, without asking for anything more.
      if (answer.status === "ready") {
        const written = await withLearnerWrite(() =>
          openWrittenLessonAction({
            blockId: destination.blockId,
            sessionId: destination.sessionId,
            timeZone: getLocalTimeZone(),
          }),
        );

        if (!stillHere()) {
          return false;
        }

        if (written?.kind === "lesson") {
          router.push(`/learn/${written.lessonId}?session=${written.sessionId}`);
          return true;
        }
      }

      openSession(
        {
          blockId: destination.blockId,
          generationId: answer.status === "writing" ? answer.generationId : undefined,
          limit: answer.status === "refused" ? answer.limit : null,
          reason:
            answer.status === "plusRequired" || answer.status === "setAside"
              ? answer.status
              : undefined,
        },
        onSessionAddress,
      );

      return true;
    },
    [openSession, router],
  );
}

/**
 * Opens where a block of today's session is played. A lesson that isn't written yet is asked for
 * from here, on the learner's tap, so the API's answer (a run to follow, or why not now) reaches
 * the session screen that shows it. A step that changed since the screen showed it opens nothing:
 * the screen reads itself again (`refresh`).
 */
export function useGoToStudyDestination({ refresh }: { refresh?: () => void } = {}) {
  const router = useRouter();
  const openSession = useOpenSession();
  const openUnwrittenLesson = useOpenUnwrittenLesson();
  const reread = useReread(refresh);

  return useCallback(
    async (
      destination: StudyDestination | null,
      { onSessionAddress }: { onSessionAddress?: (address: SessionAddress) => void } = {},
    ): Promise<boolean> => {
      if (!destination) {
        return false;
      }

      if (destination.kind === "unwrittenLesson") {
        return openUnwrittenLesson(destination, onSessionAddress);
      }

      if (destination.kind === "lesson") {
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
      } else if (destination.kind === "changed") {
        reread();
      } else if (destination.kind === "preparingLesson") {
        openSession(
          { blockId: destination.blockId, limit: null, preparing: true },
          onSessionAddress,
        );
      } else {
        openSession({ blockId: destination.blockId, limit: null }, onSessionAddress);
      }

      return true;
    },
    [openSession, openUnwrittenLesson, reread, router],
  );
}

/**
 * Runs an action that opens a block, then goes where it's played, unless the learner moved on
 * meanwhile. Resolves to whether it went.
 */
function useOpenDestination({ refresh }: { refresh?: () => void } = {}) {
  const go = useGoToStudyDestination({ refresh });

  return useCallback(
    async (action: () => Promise<StudyDestination | null>): Promise<boolean> => {
      const openedFrom = getCurrentLocation();
      const destination = await action();

      return openedFrom === getCurrentLocation() ? go(destination) : false;
    },
    [go],
  );
}

/**
 * Where today's missions and a new learner's first steps open, from their chips on Today and their
 * rows in the buddy's day: one of the day's blocks, started like any block the learner picks, or
 * the page where the rest is done. A call opens its unit's page and a question the buddy's tab,
 * where the learner starts it, the tap saving the day meanwhile (`openPage`). A host showing a day
 * not opened yet opens its steps (`openStep`), and reads its own view again (`refresh`) when a
 * chip's block didn't open.
 */
export function useMissionLinks(
  goalId: string,
  {
    openStep,
    refresh,
  }: { openStep?: (ref: DayBlockRef) => Promise<boolean>; refresh?: () => void } = {},
): MissionLinks {
  const navigate = useOpenDestination({ refresh });
  const reread = useReread(refresh);

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
        const openedFrom = getCurrentLocation();

        // Starting the block is a write: another tab's Today shows the day started, as after a
        // row's tap.
        const opened = await navigate(() =>
          withLearnerWrite(() => openMissionAction({ blockId, timeZone: getLocalTimeZone() })),
        );

        if (!opened && openedFrom === getCurrentLocation()) {
          reread();
        }

        return opened;
      },
      // Fired with the tap, never awaited: the page opens at once (see `saveMissionDayAction`).
      openPage: () => {
        saveMissionDayAction({ goalId, timeZone: getLocalTimeZone() }).catch(() => null);
      },
      openStep,
    }),
    [goalId, navigate, openStep, reread],
  );
}

/**
 * Moves through a saved day's session: each action opens where the next block is played. Stopping
 * for today shows what changed so far on the session screen; the rest waits on Today.
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
