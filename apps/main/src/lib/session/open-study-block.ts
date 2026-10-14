import "server-only";
import { openLanguageCheckpointCall } from "@zoonk/core/language/conversations/start";
import { getLessonGenerationState } from "@zoonk/core/library/generation/state";
import { startStudyBlock } from "@zoonk/core/sessions/start-block";
import { type StudyBlock } from "@zoonk/learn/session/types";
import { prepareStudySession } from "./session-preparation";
import { type StudyDestination } from "./study-destination";

/**
 * Where a checkpoint or mock block opens. A planned challenge that hasn't started (or stepped aside)
 * opens on its intro, which starts it. Through the block's page, which redirects there, the
 * intro's Start landed back on the intro: the router kept that redirect for the block's address.
 * A language goal's call opens on the block's page, which takes it to the call.
 */
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

    // A language goal's call the learner's plan leaves to Plus opens on its intro too, locked.
    if (call.status === "notLanguage" || call.status === "plusRequired") {
      return { kind: "challenge", planItemId: block.planItemId, sessionId };
    }
  }

  // An exam's weekly Big Challenge is a mock in real conditions, on its own screen.
  return { blockId: block.id, kind: block.checkpoint?.mock ? "mock" : "checkpoint", sessionId };
}

/** A lesson still being written can't open yet: the session screen shows the wait instead. */
async function isLessonReady(lessonId: string | null): Promise<boolean> {
  if (!lessonId) {
    return false;
  }

  const state = await getLessonGenerationState(lessonId);
  return state?.status === "ready";
}

/**
 * Starts a block and says where it's played. Checkpoints and mocks start on their own screen, and a
 * lesson that isn't ready isn't started: the learner's browser asks for it right away (so the
 * answer, including a refusal, reaches the screen), then the session screen shows the wait or why
 * it can't be written now, with a ready block to do meanwhile. Other blocks opened get the rest of
 * the session and the next study day written in the background.
 */
export async function openStudyBlock({
  block,
  sessionId,
  timeZone,
}: {
  block: Pick<StudyBlock, "checkpoint" | "id" | "kind" | "lessonId" | "planItemId" | "status">;
  sessionId: string;
  timeZone: string;
}): Promise<StudyDestination | null> {
  if (block.kind === "learn" && !(await isLessonReady(block.lessonId))) {
    if (!block.lessonId) {
      // A plan placeholder has no browser generation endpoint until preparation picks its lesson.
      prepareStudySession(sessionId);
      return { blockId: block.id, kind: "session" };
    }

    /** Preparation would compete with the browser's request and hide its refusal or use its allowance. */
    return { blockId: block.id, kind: "unwrittenLesson", lessonId: block.lessonId };
  }

  prepareStudySession(sessionId);

  if (block.kind === "checkpoint") {
    if (block.status === "active") {
      const resumed = await startStudyBlock({ blockId: block.id, input: { timeZone }, sessionId });

      // Started while the plan had Plus: its intro says what Plus unlocks now.
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

  if (block.kind === "produce") {
    return { blockId: block.id, kind: "essay" };
  }

  return block.kind === "learn" && block.lessonId
    ? { kind: "lesson", lessonId: block.lessonId, sessionId }
    : { blockId: block.id, kind: "session" };
}
