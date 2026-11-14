import { prisma } from "@zoonk/db";
import { readInsightPayload } from "../../memory/insights/_utils/insight-view";
import { parsePlanChangePayload } from "../_utils/plan-change-payload";
import { getPlanChangeQuote } from "../_utils/plan-change-quote";
import { type PlanChangeQuote } from "../plan-decision-contract";

/** The quote an app showing the change right now holds, which an accept sends back. */
export async function seenQuote(changeId: string): Promise<PlanChangeQuote> {
  const change = await prisma.planChange.findUniqueOrThrow({ where: { id: changeId } });
  return getPlanChangeQuote(parsePlanChangePayload(change.payload).effect);
}

/** The same for a plan change insight: the quote of the change behind it. */
export async function seenInsightQuote(insightId: string): Promise<PlanChangeQuote | null> {
  const insight = await prisma.memoryInsight.findUniqueOrThrow({ where: { id: insightId } });
  const { planChangeId } = readInsightPayload(insight.payload);
  return planChangeId ? seenQuote(planChangeId) : null;
}
