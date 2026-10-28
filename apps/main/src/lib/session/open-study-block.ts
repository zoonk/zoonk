import "server-only";
import { openLanguageCheckpointCall } from "@zoonk/core/language/conversations/start";
import { getLessonGenerationState } from "@zoonk/core/library/generation/state";
import { getDayBlockScreen } from "@zoonk/core/sessions/day-block";
import { startStudyBlock } from "@zoonk/core/sessions/start-block";
import { type StudyBlock } from "@zoonk/learn/session/types";
import { prepareStudySession } from "./session-preparation";
import { type StudyDestination } from "./study-destination";

/** Straight to the intro: the router keeps the block page's redirect, so Start would land back on the intro. */
async function toChallengeDestination({
  block,
  sessionId,
}: {
  block: Pick<StudyBlock, "checkpoint" | "id" | "planItemId" | "status">;
  sessionId: string;
}): Promise<StudyDestination> {
  const waiting = block.status === "pending" || block.status === "skipped";

  if (waiting && block.planItemId) {
    const call = await openLanguageCheckpointCall(block.id);

    if (call.status === "earlierFirst") {
      return { kind: "today" };
    }

    if (call.status === "notLanguage" || call.status === "plusRequired") {
      return { kind: "challenge", planItemId: block.planItemId, sessionId };
    }
  }

  return { blockId: block.id, kind: block.checkpoint?.mock ? "mock" : "checkpoint", sessionId };
}

async function isLessonReady(lessonId: string | null): Promise<boolean> {
  if (!lessonId) {
    return false;
  }

  const state = await getLessonGenerationState(lessonId);
  return state?.status === "ready";
}

export async function openStudyBlock({
  block,
  sessionId,
  timeZone,
}: {
  block: Pick<StudyBlock, "checkpoint" | "id" | "kind" | "lessonId" | "planItemId" | "status">;
  sessionId: string;
  timeZone: string;
}): Promise<StudyDestination | null> {
  const lessonReady = block.kind === "learn" ? await isLessonReady(block.lessonId) : null;
  const screen = getDayBlockScreen(block, { lessonReady });

  if (block.kind === "learn" && screen === "session") {
    if (!block.lessonId) {
      // A plan placeholder has no browser generation endpoint until preparation picks its lesson.
      prepareStudySession(sessionId);
      return { blockId: block.id, kind: "preparingLesson" };
    }

    // Preparation would compete with the browser's request and hide its refusal or use its allowance.
    return { blockId: block.id, kind: "unwrittenLesson", lessonId: block.lessonId, sessionId };
  }

  prepareStudySession(sessionId);

  if (screen === "challenge") {
    if (block.status === "active") {
      const resumed = await startStudyBlock({ blockId: block.id, input: { timeZone }, sessionId });

      if (resumed.status === "plusRequired" && block.planItemId) {
        return { kind: "challenge", planItemId: block.planItemId, sessionId };
      }

      if (resumed.status !== "ready") {
        return null;
      }
    }

    return toChallengeDestination({ block, sessionId });
  }

  const started = await startStudyBlock({ blockId: block.id, input: { timeZone }, sessionId });

  if (started.status === "dailyLimitReached") {
    return { kind: "today" };
  }

  if (started.status === "blockFinished") {
    return { kind: "session" };
  }

  if (started.status !== "ready") {
    return null;
  }

  if (screen === "essay") {
    return { blockId: block.id, kind: "essay" };
  }

  return screen === "lesson" && block.lessonId
    ? { kind: "lesson", lessonId: block.lessonId, sessionId }
    : { blockId: block.id, kind: "session" };
}
