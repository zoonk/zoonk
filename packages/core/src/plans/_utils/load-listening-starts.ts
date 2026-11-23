import "server-only";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { loadListeningExam } from "../../exams/listening/listening-exam";
import { getListeningSkillIds } from "../../exams/listening/listening-skills";
import { getKnownSubjects, getOwnLevel } from "../../learner/placement/placement-contract";
import { type PlanGraph } from "../planner/plan-state";
import { getLevelFloor } from "./level-bands";
import { pickListeningPastBasicsAreas } from "./level-listening-starts";
import { parsePlanChangePayload } from "./plan-change-payload";

export async function listChosenStartAreas(
  planId: string,
  tx: TransactionClient = prisma,
): Promise<Set<string>> {
  const changes = await tx.planChange.findMany({
    select: { payload: true },
    where: {
      payload: { array_contains: [{ kind: "setAreaStart" }], path: ["operations"] },
      planId,
      status: "applied",
    },
  });

  return new Set(
    changes.flatMap((change) =>
      parsePlanChangePayload(change.payload).operations.flatMap((operation) =>
        operation.kind === "setAreaStart" ? operation.areas : [],
      ),
    ),
  );
}

export async function listListeningPastBasicsAreas({
  goal,
  graph,
  planId,
}: {
  goal: Pick<Goal, "details" | "id">;
  graph: PlanGraph;
  planId: string;
}): Promise<string[]> {
  if (getLevelFloor(getOwnLevel({ goal })) === null && getKnownSubjects(goal).length === 0) {
    return [];
  }

  const exam = await loadListeningExam(goal.id);
  const listening = getListeningSkillIds({ exam, graph });

  if (listening.size === 0) {
    return [];
  }

  const chosen = await listChosenStartAreas(planId);
  return pickListeningPastBasicsAreas({ chosen, goal, graph, listening });
}
