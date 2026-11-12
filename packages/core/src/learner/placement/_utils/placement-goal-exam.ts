import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { readDatabaseFacts } from "../../../_utils/read-database-facts";
import { toChosenStructure } from "../../../exams/choices/exam-choices";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { readNoticeFormats } from "../../../library/exams/notice-formats";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { getTrueFalseLabels } from "../../../library/exams/true-false-labels";
import { getAreaShares } from "../../../plans/_utils/exam-subject-shares";
import {
  type PlanGraph,
  type PlanSettings,
  parsePlanGraph,
  parsePlanSettings,
} from "../../../plans/planner/plan-state";
import { getKnownSubjects, getOwnLevel, isLevelMeasured } from "../placement-contract";
import { isOwnMaterialTest } from "../placement-material";
import { confirmsInWriting, getPlacementQuickFormat } from "../placement-quick-format";
import { toTestSetup } from "./focus-test-setup";

function getChosenAreaShares({
  graph,
  settings,
  structure,
}: {
  graph: PlanGraph;
  settings: PlanSettings;
  structure: ExamStructure | null;
}): Map<string, number> | null {
  return structure
    ? getAreaShares({ graph, structure: toChosenStructure({ picks: settings, structure }) })
    : null;
}

export async function loadGoalExam(goalId: string, tx: TransactionClient) {
  const [goal, plan] = await readDatabaseFacts(
    tx,
    () => tx.goal.findUnique({ include: { examBlueprint: true }, where: { id: goalId } }),
    () =>
      tx.plan.findUnique({
        select: { coveredShare: true, graph: true, id: true, settings: true },
        where: { goalId },
      }),
  );

  const blueprint = goal?.examBlueprint ?? null;
  const structure = blueprint ? readBlueprintContent(blueprint).structure : null;
  const notice = readNoticeFormats(goal?.details);
  const graph = parsePlanGraph(plan?.graph);
  const settings = parsePlanSettings(plan?.settings);

  return {
    answeredOnly: isOwnMaterialTest(blueprint),
    areaShares: getChosenAreaShares({ graph, settings, structure }),
    examBlueprintId: blueprint?.id ?? null,
    focusAreas: settings.focusAreas,
    goalCreatedAt: goal?.createdAt ?? null,
    goalLevel: goal ? getOwnLevel({ goal }) : null,
    knownAreas: goal ? getKnownSubjects(goal) : [],
    measuredLevel: goal && isLevelMeasured(goal) ? getOwnLevel({ goal }) : null,
    quickFormat: getPlacementQuickFormat(structure ?? notice),
    test: goal && plan ? toTestSetup({ goal, graph, plan, settings, structure }) : null,
    trueFalseLabels: getTrueFalseLabels(structure ?? notice),
    typed: goal ? confirmsInWriting(goal) : false,
  };
}
