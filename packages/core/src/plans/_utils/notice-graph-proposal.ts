import { AnyNull } from "@zoonk/db";
import { type PlanOperation } from "../plan-contract";

const FOLLOW_NOTICE = "followNotice";
const operationsPath = ["operations"];

export const noticeGraphPayload = {
  array_contains: [{ kind: FOLLOW_NOTICE }],
  path: operationsPath,
};

export const waitingPlanProposal = {
  OR: [
    { NOT: { payload: noticeGraphPayload } },
    { payload: { equals: AnyNull, path: operationsPath } },
  ],
  status: "proposed" as const,
};

export function proposesNoticeGraph(operations: readonly PlanOperation[]): boolean {
  return operations.some(({ kind }) => kind === FOLLOW_NOTICE);
}
