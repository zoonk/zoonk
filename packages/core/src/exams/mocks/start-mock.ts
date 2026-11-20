import "server-only";
import { type StudySessionBlock } from "@zoonk/db";
import { startStudyBlock } from "../../sessions/start-study-block";
import { findOwnedMock } from "./_utils/owned-mock";
import { type MockTimeZoneInput } from "./mock-contract";

export type StartMockResult = {
  status:
    | "blockFinished"
    | "expired"
    | "finished"
    | "notFound"
    | "preparing"
    | "ready"
    | "unauthorized";
};

async function startScheduledBlock({
  block,
  input,
}: {
  block: Pick<StudySessionBlock, "id" | "sessionId">;
  input: MockTimeZoneInput;
}): Promise<StartMockResult> {
  const started = await startStudyBlock({ blockId: block.id, input, sessionId: block.sessionId });

  if (started.status === "questionsNeeded") return { status: "preparing" };
  if (started.status === "earlierFirst" || started.status === "plusRequired") {
    throw new Error(`Mock block ${block.id} was refused as a phase challenge: ${started.status}.`);
  }

  return { status: started.status };
}

export async function startMock({
  blockId,
  input,
}: {
  blockId: string;
  input: MockTimeZoneInput;
}): Promise<StartMockResult> {
  const found = await findOwnedMock(blockId);

  if (found.status !== "ready") {
    return found;
  }

  const { owned } = found;

  if (owned.mock && (!owned.block || owned.mock.status === "finished")) {
    return { status: owned.mock.status === "active" ? "ready" : owned.mock.status };
  }

  if (!owned.block) {
    return { status: "notFound" };
  }

  return startScheduledBlock({ block: owned.block, input });
}
