import "server-only";
import { oweFollowUps } from "../../follow-ups/owe-follow-ups";
import { oweGoalLessons } from "../../follow-ups/owe-goal-lessons";
import { openLanguageCheckpointCall } from "../../language/conversations/start-language-conversation";
import { type OpenStudyBlockResult, type StudyBlockOpening } from "../open-block-contract";
import { type StartStudyBlockResult, startStudyBlock } from "../start-study-block";
import { type StudyBlockView } from "./session-view";

type BlockToOpen = {
  block: Pick<
    StudyBlockView,
    "checkpoint" | "id" | "kind" | "lessonId" | "planItemId" | "screen" | "status"
  >;
  goalId: string | null;
  sessionId: string;
  timeZone: string | undefined;
  /** From the capability that authorized the session. */
  userId: string;
};

export function openingResult(opening: StudyBlockOpening): OpenStudyBlockResult {
  return { opening, status: "ready" };
}

/** A refusal only a challenge's start gives (Plus, unwritten questions, an exam choice) is explained by its own screen. */
function afterStart({
  opening,
  sessionId,
  started,
}: {
  opening: StudyBlockOpening;
  sessionId: string;
  started: StartStudyBlockResult;
}): OpenStudyBlockResult {
  switch (started.status) {
    case "ready":
    case "needsChoice":
    case "plusRequired":
    case "preparing":
    case "questionsNeeded":
    case "signUpRequired":
      return openingResult(opening);
    case "blockFinished":
      return openingResult({ blockId: null, kind: "session", sessionId });
    case "earlierFirst":
      return openingResult({ kind: "today" });
    case "notFound":
    case "unauthorized":
      return { status: started.status };
    default:
      return started satisfies never;
  }
}

function prepareSession({ sessionId, userId }: Pick<BlockToOpen, "sessionId" | "userId">) {
  return oweFollowUps({ followUps: [{ input: { sessionId }, kind: "prepareSession" }], userId });
}

/**
 * The plan's written test has no plan item, so no intro: the tap starts it, and what can't start yet
 * stays on Today, which says why.
 */
async function startMockWithoutIntro({
  screen,
  toOpen: { block, sessionId, timeZone },
}: {
  screen: StudyBlockOpening;
  toOpen: Pick<BlockToOpen, "block" | "sessionId" | "timeZone">;
}): Promise<OpenStudyBlockResult> {
  const started = await startStudyBlock({ blockId: block.id, input: { timeZone }, sessionId });

  return started.status === "needsChoice" ||
    started.status === "plusRequired" ||
    started.status === "preparing" ||
    started.status === "signUpRequired"
    ? openingResult({ kind: "today" })
    : afterStart({ opening: screen, sessionId, started });
}

/** A waiting language checkpoint opens its call first; any other challenge opens its intro. */
async function openChallenge({
  block,
  sessionId,
  timeZone,
}: BlockToOpen): Promise<OpenStudyBlockResult> {
  const screen: StudyBlockOpening = {
    blockId: block.id,
    kind: block.checkpoint?.mock ? "mock" : "checkpoint",
    sessionId,
  };

  const intro: StudyBlockOpening | null = block.planItemId
    ? { kind: "challenge", planItemId: block.planItemId, sessionId }
    : null;

  if (block.status === "active") {
    const resumed = await startStudyBlock({ blockId: block.id, input: { timeZone }, sessionId });

    return afterStart({
      opening:
        (resumed.status === "needsChoice" ||
          resumed.status === "plusRequired" ||
          resumed.status === "preparing") &&
        intro
          ? intro
          : screen,
      sessionId,
      started: resumed,
    });
  }

  if (block.status === "pending" && !intro && block.checkpoint?.mock && block.checkpoint.written) {
    return startMockWithoutIntro({ screen, toOpen: { block, sessionId, timeZone } });
  }

  if ((block.status === "pending" || block.status === "skipped") && intro) {
    const call = await openLanguageCheckpointCall(block.id);

    if (call.status === "earlierFirst") {
      return openingResult({ kind: "today" });
    }

    if (call.status === "notLanguage" || call.status === "plusRequired") {
      return openingResult(intro);
    }
  }

  return openingResult(screen);
}

function toStartedOpening({ block, sessionId }: BlockToOpen): StudyBlockOpening {
  if (block.kind === "produce") {
    return { blockId: block.id, kind: "essay", sessionId };
  }

  return block.kind === "learn" && block.lessonId
    ? { kind: "lesson", lessonId: block.lessonId, sessionId }
    : { blockId: block.id, kind: "session", sessionId };
}

/**
 * Where a block of an owned session opens. A lesson that isn't written is left to the learner's
 * request for it: preparation would compete with that request and hide its refusal or use its
 * allowance. If its former lesson was deleted, the goal can ask for its lessons again.
 */
export async function openSessionBlock(toOpen: BlockToOpen): Promise<OpenStudyBlockResult> {
  const { block, goalId, sessionId, timeZone, userId } = toOpen;

  if (block.kind === "learn" && block.screen !== "lesson") {
    if (!block.lessonId) {
      if (goalId) {
        await oweGoalLessons({ goalId, requirePlan: true, userId });
      }

      return openingResult({ kind: "today" });
    }

    return openingResult({
      blockId: block.id,
      kind: "unwrittenLesson",
      lessonId: block.lessonId,
      sessionId,
    });
  }

  if (block.kind === "checkpoint") {
    const [opened] = await Promise.all([openChallenge(toOpen), prepareSession(toOpen)]);
    return opened;
  }

  const started = await startStudyBlock({ blockId: block.id, input: { timeZone }, sessionId });
  return afterStart({ opening: toStartedOpening(toOpen), sessionId, started });
}
