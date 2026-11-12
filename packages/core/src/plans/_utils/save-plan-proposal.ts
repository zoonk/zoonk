import "server-only";
import { type TransactionClient } from "@zoonk/db";
import {
  getProposedAreas,
  loadFocusProposalFacts,
} from "../../learner/placement/_utils/focus-proposal-facts";
import { FOCUS_TEST_SOURCE } from "../../learner/placement/focus-test-contract";
import { readFocusTestRecord } from "../../learner/placement/focus-test-state";
import { type PlanOperation } from "../plan-contract";
import { type StoredPlanChangePayload } from "./plan-change-payload";
import { type PlanContext } from "./plan-context";
import { writePlanMetadata } from "./plan-metadata-write";
import { replaceWaitingProposals } from "./replace-waiting-proposals";
import { type PlanChangeRecord } from "./replan";

export async function savePlanProposal({
  context,
  extraWrites,
  operations,
  payload,
  provenance,
  reason,
  source,
}: {
  context: PlanContext;
  extraWrites?: (tx: TransactionClient) => Promise<unknown>;
  operations: readonly PlanOperation[];
  payload: StoredPlanChangePayload;
  provenance: PlanChangeRecord["provenance"] | null;
  reason: string;
  source: string;
}) {
  return writePlanMetadata({
    context,
    write: async (tx) => {
      if (source === FOCUS_TEST_SOURCE) {
        const goal = await tx.goal.findUniqueOrThrow({ where: { id: context.goal.id } });
        const areas = getProposedAreas(payload);

        const { due } = await loadFocusProposalFacts({
          asks: goal.targetDate !== null && areas.length > 0,
          goal,
          plan: { ...context.plan, focusAreas: context.state.settings.focusAreas },
          record: readFocusTestRecord(goal),
          suggested: areas,
          tx,
        });

        if (!due) {
          return null;
        }
      }

      const created = await tx.planChange.create({
        data: {
          kind: "edited",
          payload,
          planId: context.plan.id,
          reason,
          status: "proposed",
          ...provenance,
        },
      });

      await extraWrites?.(tx);

      const replaced = await replaceWaitingProposals({
        applied: false,
        except: created.id,
        operations,
        planId: context.plan.id,
        source,
        tx,
      });

      return { id: created.id, replaced };
    },
  });
}
