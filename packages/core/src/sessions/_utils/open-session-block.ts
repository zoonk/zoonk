import "server-only";
import { oweFollowUps } from "../../follow-ups/owe-follow-ups";
import { openLanguageCheckpointCall } from "../../language/conversations/start-language-conversation";
import { type OpenStudyBlockResult, type StudyBlockOpening } from "../open-block-contract";
import { type StartStudyBlockResult, startStudyBlock } from "../start-study-block";
import { type StudyBlockView } from "./session-view";

type BlockToOpen = {
  block: Pick<
    StudyBlockView,
    "checkpoint" | "id" | "kind" | "lessonId" | "planItemId" | "screen" | "status"
  >;
  sessionId: string;
  timeZone: string | undefined;
  /** From the capability that authorized the session. */
  userId: string;
};

export function openingResult(opening: StudyBlockOpening): OpenStudyBlockResult {
  return { opening, status: "ready" };
}

/** A refusal only a challenge's start gives (Plus, unwritten questions) is explained by its own screen. */
function afterStart(
  started: StartStudyBlockResult,
  opening: StudyBlockOpening,
): OpenStudyBlockResult {
  switch (started.status) {
    case "ready":
    case "plusRequired":
    case "questionsNeeded":
      return openingResult(opening);
    case "blockFinished":
      return openingResult({ blockId: null, kind: "session" });
    case "dailyLimitReached":
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
    return afterStart(resumed, resumed.status === "plusRequired" && intro ? intro : screen);
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
    return { blockId: block.id, kind: "essay" };
  }

  return block.kind === "learn" && block.lessonId
    ? { kind: "lesson", lessonId: block.lessonId, sessionId }
    : { blockId: block.id, kind: "session" };
}

/**
 * Where a block of an owned session opens. A lesson that isn't written is left to the learner's
 * request for it: preparation would compete with that request and hide its refusal or use its
 * allowance. A placeholder has no lesson to ask for until preparation picks it.
 */
export async function openSessionBlock(toOpen: BlockToOpen): Promise<OpenStudyBlockResult> {
  const { block, sessionId, timeZone } = toOpen;

  if (block.kind === "learn" && block.screen !== "lesson") {
    if (!block.lessonId) {
      await prepareSession(toOpen);
      return openingResult({ blockId: block.id, kind: "preparingLesson" });
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
  return afterStart(started, toStartedOpening(toOpen));
}
