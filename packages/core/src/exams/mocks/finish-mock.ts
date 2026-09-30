import "server-only";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { endMock } from "./_utils/end-mock";
import { findOwnedMock, getSectionDeadline } from "./_utils/owned-mock";
import { type MockTimeZoneInput } from "./mock-contract";

export type FinishMockResult = { status: "finished" | "notFound" | "notRunning" | "unauthorized" };

/**
 * Ends the mock now, like leaving the exam room early: every question not answered counts as
 * blank, and it's graded as it stands. The running section counts as timed out when its clock
 * already ran out.
 */
export async function finishMock({
  blockId,
  input,
}: {
  blockId: string;
  input: MockTimeZoneInput;
}): Promise<FinishMockResult> {
  const found = await findOwnedMock(blockId);

  if (found.status !== "ready") {
    return found;
  }

  const { owned } = found;
  const { mock } = owned;

  if (mock?.status !== "active") {
    return { status: mock?.status === "finished" ? "finished" : "notRunning" };
  }

  const timedOut =
    mock.sectionIndex < mock.conditions.sections.length &&
    Date.now() >= getSectionDeadline(mock).getTime();

  const conditions = timedOut
    ? {
        ...mock.conditions,
        timedOutSections: [...mock.conditions.timedOutSections, mock.sectionIndex],
      }
    : mock.conditions;

  const status = await endMock({
    conditions,
    mock,
    owned,
    timeZone: getAnswerTimeZone({ goal: owned.goal, timeZone: input.timeZone }),
  });

  return { status };
}
