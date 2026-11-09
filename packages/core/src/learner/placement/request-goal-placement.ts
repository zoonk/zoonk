import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { isPlacementAhead } from "../../view-models/onboarding/onboarding-steps";
import { unchanged, writeLearnerChange } from "../_utils/write-learner-change";

/** Internal workflow bridge: a rebuilt goal needs questions only while its learner still wants placement. */
export async function requestGoalPlacement(goalId: string): Promise<boolean> {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });

  if (!goal) {
    return false;
  }

  return writeLearnerChange(
    { goalIds: [goalId], planInputs: true, userId: goal.userId },
    async (tx) => {
      const current = await tx.goal.findUnique({ where: { id: goalId } });

      if (
        !current ||
        current.status !== "active" ||
        !isPlacementAhead(isJsonObject(current.details) ? current.details : {})
      ) {
        return unchanged(false);
      }

      const changed = await tx.plan.updateMany({
        data: { placementPreparedAt: null },
        where: { goalId },
      });

      return changed.count > 0 ? true : unchanged(false);
    },
  );
}
