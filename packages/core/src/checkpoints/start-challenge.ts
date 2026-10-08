import "server-only";
import { startMock } from "../exams/mocks/start-mock";
import { readBlockPayload } from "../sessions/block-payload";
import { type StudySessionTimeZoneInput } from "../sessions/contract";
import { ensureStudySession } from "../sessions/ensure-study-session";
import { startStudyBlock } from "../sessions/start-study-block";
import { findOwnedChallenge } from "./_utils/owned-challenge";
import { type ChallengeDestination } from "./challenge-contract";

export type StartChallengeResult =
  | { destination: ChallengeDestination; status: "ready" }
  | { status: "blockFinished" | "dailyLimitReached" | "notFound" | "notToday" | "unauthorized" };

type StartedBlock = { id: string; isMock: boolean; isCall: boolean; sessionId: string };

/** Starts the block: a mock fixes its sections and starts its clock, a duel its first question. */
async function startBlock({
  block,
  input,
}: {
  block: StartedBlock;
  input: StudySessionTimeZoneInput;
}): Promise<StartChallengeResult["status"]> {
  // A language goal's checkpoint is the unit's call: its own screen opens it.
  if (block.isCall) {
    return "ready";
  }

  if (block.isMock) {
    const started = await startMock({ blockId: block.id, input });
    return started.status === "finished" ? "blockFinished" : started.status;
  }

  const started = await startStudyBlock({ blockId: block.id, input, sessionId: block.sessionId });
  return started.status;
}

/**
 * "Start" on a challenge's intro, on its day: today's session is planned if it isn't yet, the
 * challenge's block in it starts (or resumes) and the result says where it's played. A
 * challenge today's session doesn't hold, such as one whose day hasn't come, can't start.
 */
export async function startChallenge({
  input,
  planItemId,
}: {
  input: StudySessionTimeZoneInput;
  planItemId: string;
}): Promise<StartChallengeResult> {
  const owned = await findOwnedChallenge({ planItemId, timeZone: input.timeZone });

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, item, timeZone, today, userId } = owned.challenge;

  // A paused, completed or archived goal has no day to plan.
  if (goal.status !== "active") {
    return { status: "notToday" };
  }

  const session = await ensureStudySession({ goal, localDate: today, timeZone, userId });

  const block = session.blocks.find(
    (candidate) =>
      candidate.kind === "checkpoint" && readBlockPayload(candidate).planItemId === item.id,
  );

  if (!block) {
    return { status: "notToday" };
  }

  const payload = readBlockPayload(block);

  const status = await startBlock({
    block: {
      id: block.id,
      isCall: goal.kind === "language" && payload.checkpoint?.kind !== "weekly",
      isMock: Boolean(payload.checkpoint?.mock),
      sessionId: session.id,
    },
    input,
  });

  if (status !== "ready") {
    return { status };
  }

  return {
    destination: {
      blockId: block.id,
      kind: payload.checkpoint?.mock ? "mock" : "checkpoint",
      sessionId: session.id,
    },
    status: "ready",
  };
}
