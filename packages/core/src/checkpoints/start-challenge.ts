import "server-only";
import { startMock } from "../exams/mocks/start-mock";
import { readBlockPayload } from "../sessions/block-payload";
import { type StudyBlockStartInput } from "../sessions/contract";
import { ensureStudySession } from "../sessions/ensure-study-session";
import { type StartStudyBlockResult, startStudyBlock } from "../sessions/start-study-block";
import { needsPlus } from "./_utils/challenge-plus";
import { findOwnedChallenge } from "./_utils/owned-challenge";
import { type ChallengeDestination } from "./challenge-contract";

/**
 * `questionsNeeded`: the bank still holds too few questions for it; once they're written
 * (`requestChallengeQuestions`), starting it again asks them. `plusRequired`: the learner's plan
 * leaves it to Plus (a mock, or a phase challenge past a free exam plan's first week).
 */
export type StartChallengeResult =
  | { destination: ChallengeDestination; status: "ready" }
  | Extract<StartStudyBlockResult, { status: "earlierFirst" }>
  | { status: "notToday" }
  | {
      status:
        | "blockFinished"
        | "dailyLimitReached"
        | "notFound"
        | "plusRequired"
        | "questionsNeeded"
        | "unauthorized";
    };

type StartedBlock = { id: string; isMock: boolean; sessionId: string };

/** Starts the block: a mock fixes its sections and starts its clock, a duel its first question. */
async function startBlock({
  block,
  input,
}: {
  block: StartedBlock;
  input: StudyBlockStartInput;
}): Promise<Exclude<StartChallengeResult, { status: "ready" }> | { status: "ready" }> {
  if (block.isMock) {
    const started = await startMock({ blockId: block.id, input });

    // A session's mock whose time ran out while the learner was away starts again in a new sitting.
    if (started.status === "expired") {
      throw new Error(`Mock block ${block.id} didn't start again after its time ran out.`);
    }

    if (started.status === "ready") {
      return { status: "ready" };
    }

    return { status: started.status === "finished" ? "blockFinished" : started.status };
  }

  return startStudyBlock({ blockId: block.id, input, sessionId: block.sessionId });
}

/**
 * "Start" on a challenge's intro, on its day: today's session is planned if it isn't yet, the
 * challenge's block in it starts (or resumes) and the result says where it's played. A
 * challenge today's session doesn't hold, such as one whose day hasn't come, can't start, and
 * one the bank holds too few questions for needs them written first (see `startStudyBlock`).
 */
export async function startChallenge({
  input,
  planItemId,
}: {
  input: StudyBlockStartInput;
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

  if (await needsPlus(owned.challenge)) {
    return { status: "plusRequired" };
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

  const started = await startBlock({
    block: { id: block.id, isMock: Boolean(payload.checkpoint?.mock), sessionId: session.id },
    input,
  });

  if (started.status !== "ready") {
    return started;
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
