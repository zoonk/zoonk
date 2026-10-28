import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { getSkillArea } from "../../../plans/planner/graph-areas";
import { parsePlanGraph } from "../../../plans/planner/plan-state";
import { loadListeningExam } from "../../listening/listening-exam";
import { getListeningSkillIds } from "../../listening/listening-skills";
import { ONE_PICK_MIX, getMockFormatMix } from "../mock-format-mix";
import { isOptionArea } from "../mock-options";
import { countPlannedQuestions } from "../mock-plan";
import {
  type MockFormatShortfall,
  type MockWritingSkill,
  getMockQuestionsShortfall,
} from "../mock-shortfall";
import { getPlacementQuestionsShortfall } from "../placement-mock";
import { type AnytimeMockPick, type AnytimeMockSetup } from "./anytime-mock-setup";
import { planFromBank } from "./create-anytime-mock";

async function loadOptionSkills({
  goalId,
  option,
  structure,
}: {
  goalId: string;
  option: Parameters<typeof isOptionArea>[0]["option"];
  structure: ExamStructure | null;
}): Promise<MockWritingSkill[] | null> {
  const [plan, exam] = await Promise.all([
    prisma.plan.findUnique({ select: { graph: true }, where: { goalId } }),
    loadListeningExam(goalId),
  ]);

  const graph = parsePlanGraph(plan?.graph);

  if (graph.skills.length === 0) {
    return null;
  }

  const asksAll = !option.area && option.areas.length === 0;
  const listening = getListeningSkillIds({ exam, graph });

  return graph.skills.flatMap((skill) => {
    const area = getSkillArea({ graph, skill });
    const asked = asksAll || isOptionArea({ area, option, structure });
    return asked && !listening.has(skill.skillId) ? [{ area, id: skill.skillId }] : [];
  });
}

function listWrites({
  mix,
  optionSkills,
  pick,
  planned,
}: {
  mix: ReturnType<typeof getMockFormatMix>;
  optionSkills: readonly MockWritingSkill[];
  pick: AnytimeMockPick;
  planned: Awaited<ReturnType<typeof planFromBank>>;
}): MockFormatShortfall[] {
  if (pick.purpose !== "placement") {
    return getMockQuestionsShortfall({
      candidates: planned.candidates,
      mix,
      option: pick.option,
      plan: planned.plan,
      skills: optionSkills,
    });
  }

  const shortfall = getPlacementQuestionsShortfall({
    missingSkillIds: planned.missingSkillIds,
    option: pick.option,
    planned: countPlannedQuestions(planned.plan) - planned.plan.reused,
  });

  return shortfall
    ? ONE_PICK_MIX.map((format) => ({ ...shortfall, format, target: shortfall.questionsPerSkill }))
    : [];
}

export async function planMockWrites({
  goal,
  pick,
  setup,
  userId,
}: {
  goal: Goal;
  pick: AnytimeMockPick;
  setup: AnytimeMockSetup;
  userId: string;
}): Promise<MockFormatShortfall[] | null> {
  const [planned, optionSkills] = await Promise.all([
    planFromBank({ goal, pick, setup, userId }),
    loadOptionSkills({ goalId: goal.id, option: pick.option, structure: setup.structure }),
  ]);

  if (!optionSkills) {
    return null;
  }

  return listWrites({ mix: getMockFormatMix(setup.structure), optionSkills, pick, planned });
}
