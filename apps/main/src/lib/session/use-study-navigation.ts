"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { noteAppWrite } from "@/lib/http/app-write-ledger";
import { LESSON_GENERATION_PARAM } from "@/lib/lessons/lesson-writing-href";
import { askToWriteLesson } from "@/lib/lessons/lesson-writing-request";
import { type StudyBlockOpening } from "@zoonk/core/sessions/open-block-contract";
import { type LessonLimit } from "@zoonk/learn/help-limit";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useCallback } from "react";
import { LESSON_LIMIT_PARAM, toLessonLimitParam } from "./lesson-limit-param";
import { SESSION_BLOCK_PARAM } from "./session-block-param";
import { SESSION_GOAL_PARAM } from "./session-goal-param";
import { SESSION_PREPARING_PARAM } from "./session-preparing-param";
import { SESSION_STOPPED_HREF, SESSION_STOPPED_PARAM } from "./session-stopped-param";
import {
  addExtraStudyBlockAction,
  openStudyBlockAction,
  stopStudySessionAction,
} from "./study-session-actions";
import { answerHere, openingHere } from "./tap-answer";

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

export function useReread(refresh?: () => void) {
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

type StudyGoing = {
  here: () => Promise<boolean>;
  onSessionAddress?: (address: SessionAddress) => void;
};

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
      destination: Extract<StudyBlockOpening, { kind: "unwrittenLesson" }>,
      { here, onSessionAddress }: StudyGoing,
    ): Promise<boolean> => {
      const asked = await answerHere(askToWriteLesson(destination.lessonId), here);

      if (typeof asked === "boolean") {
        return asked;
      }

      const { answer } = asked;

      if (answer.status === "failed") {
        return false;
      }

      if (answer.status === "ready") {
        const written = await answerHere(
          noteAppWrite(
            openStudyBlockAction({
              target: { blockId: destination.blockId, kind: "block" },
              timeZone: getLocalTimeZone(),
            }),
          ),
          here,
        );

        if (typeof written === "boolean") {
          return written;
        }

        if (written.answer?.kind === "lesson") {
          const { lessonId, sessionId } = written.answer;
          router.push(`/learn/${lessonId}?session=${sessionId}`);
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
 * Resolves to false when it couldn't open, and true otherwise, also when the learner left before the
 * answer: a tap they left has nothing to report.
 */
export function useGoToStudyDestination({ refresh }: { refresh?: () => void } = {}) {
  const router = useRouter();
  const openSession = useOpenSession();
  const openUnwrittenLesson = useOpenUnwrittenLesson();
  const reread = useReread(refresh);

  return useCallback(
    async (
      destination: StudyBlockOpening | null,
      { here, onSessionAddress }: StudyGoing,
    ): Promise<boolean> => {
      if (!(await here())) {
        return true;
      }

      if (!destination) {
        return false;
      }

      if (destination.kind === "unwrittenLesson") {
        return openUnwrittenLesson(destination, { here, onSessionAddress });
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
        openSession({ blockId: destination.blockId ?? undefined, limit: null }, onSessionAddress);
      }

      return true;
    },
    [openSession, openUnwrittenLesson, reread, router],
  );
}

export function useOpenDestination() {
  const go = useGoToStudyDestination();

  return useCallback(
    async (action: () => Promise<StudyBlockOpening | null>): Promise<boolean> => {
      const here = openingHere();
      const opened = await answerHere(action(), here);
      return typeof opened === "boolean" ? opened : go(opened.answer, { here });
    },
    [go],
  );
}

export function useStudyNavigation(sessionId: string) {
  const navigate = useOpenDestination();
  const router = useRouter();

  const input = useCallback(() => ({ sessionId, timeZone: getLocalTimeZone() }), [sessionId]);

  return {
    addExtraTime: () => navigate(() => addExtraStudyBlockAction(input())),
    continueSession: () =>
      navigate(() =>
        openStudyBlockAction({ target: { kind: "next", sessionId }, timeZone: getLocalTimeZone() }),
      ),
    stop: async () => {
      const here = openingHere();
      const stopped = await answerHere(stopStudySessionAction(input()), here);

      if (typeof stopped === "boolean") {
        return stopped;
      }

      if (stopped.answer) {
        router.push(SESSION_STOPPED_HREF);
      }

      return stopped.answer;
    },
  };
}
