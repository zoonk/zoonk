"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { noteAppWrite } from "@/lib/http/app-write-ledger";
import { getLearnerGeneration } from "@/lib/learner/learner-store";
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
  openWrittenLessonAction,
  saveMissionDayAction,
  stopStudySessionAction,
} from "./study-session-actions";

export const SESSION_PATH = "/session";

type SessionScreen = {
  blockId?: string;
  generationId?: string;
  goalId?: string;
  limit: LessonLimit | null;
  preparing?: boolean;
  reason?: "plusRequired" | "setAside";
};

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

export function getCurrentLocation(): string {
  const { pathname, search } = globalThis.location;
  const [, first = "", ...rest] = pathname.split("/");
  const localized = routing.locales.some((locale) => locale === first);

  return (localized ? `/${rest.join("/")}` : pathname) + search;
}

type SessionAddress = { blockId?: string; href: string };

/** On the session screen already, it reads itself again in place: a new address would draw the frame first. */
function useOpenSession() {
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (screen: SessionScreen, onAddress?: (address: SessionAddress) => void) => {
      const href = getSessionHref(screen);

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

      if (answer.status === "failed" || !stillHere()) {
        return false;
      }

      if (answer.status === "ready") {
        const written = await noteAppWrite(
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
      openBlock: async (blockId) => {
        const openedFrom = getCurrentLocation();

        const opened = await navigate(() =>
          noteAppWrite(openMissionAction({ blockId, timeZone: getLocalTimeZone() })),
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

export function useStudyNavigation(sessionId: string) {
  const navigate = useOpenDestination();
  const router = useRouter();

  const input = useCallback(() => ({ sessionId, timeZone: getLocalTimeZone() }), [sessionId]);

  return {
    addExtraTime: () => navigate(() => addExtraStudyBlockAction(input())),
    continueSession: () => navigate(() => openNextStudyBlockAction(input())),
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
