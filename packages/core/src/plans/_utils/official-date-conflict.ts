import "server-only";
import {
  type OfficialExamDate,
  findOfficialDateConflict,
  loadExamNoticeFacts,
} from "../../exams/_utils/exam-notice-facts";
import { type PlanOperation } from "../plan-contract";
import { toIsoDate } from "../planner/plan-calendar";
import { type PlanContext } from "./plan-context";

export async function findOfficialDate({
  context,
  operations,
}: {
  context: PlanContext;
  operations: readonly PlanOperation[];
}): Promise<OfficialExamDate | null> {
  const dateChange = operations.findLast((operation) => operation.kind === "setTargetDate");

  if (dateChange?.kind !== "setTargetDate" || dateChange.targetDate === null) {
    return null;
  }

  const facts = await loadExamNoticeFacts(context.goal);

  return findOfficialDateConflict({
    facts,
    targetDate: dateChange.targetDate,
    today: toIsoDate(context.today),
  });
}
