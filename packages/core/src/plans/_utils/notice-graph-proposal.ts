import { sql } from "@zoonk/db";
import { type PlanOperation } from "../plan-contract";

const FOLLOW_NOTICE = "followNotice";
const operationsPath = ["operations"];

export const noticeGraphPayload = {
  array_contains: [{ kind: FOLLOW_NOTICE }],
  path: operationsPath,
};

export const waitingPlanProposal = sql`
  change.status = 'proposed'
  AND (change.payload #> ${operationsPath}::text[] @> ${JSON.stringify(noticeGraphPayload.array_contains)}::jsonb) IS NOT TRUE
`;

export function proposesNoticeGraph(operations: readonly PlanOperation[]): boolean {
  return operations.some(({ kind }) => kind === FOLLOW_NOTICE);
}
