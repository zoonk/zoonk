import "server-only";
import { startMock } from "../exams/mocks/start-mock";
import { readBlockPayload } from "../sessions/block-payload";
import { type StudyBlockStartInput } from "../sessions/contract";
import { ensureStudySession } from "../sessions/ensure-study-session";
import { type StartStudyBlockResult, startStudyBlock } from "../sessions/start-study-block";
import { needsPlus } from "./_utils/challenge-plus";
import { findOwnedChallenge } from "./_utils/owned-challenge";
import { type ChallengeDestination } from "./challenge-contract";

/** On questionsNeeded, request question generation before starting again; plusRequired requires upgrading. */
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

async function startBlock({
  block,
  input,
}: {
  block: StartedBlock;
  input: StudyBlockStartInput;
}): Promise<Exclude<StartChallengeResult, { status: "ready" }> | { status: "ready" }> {
  if (block.isMock) {
    const started = await startMock({ blockId: block.id, input });

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

/** Creates today's session if absent, then starts or resumes the challenge; refuses challenges outside it. */
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
