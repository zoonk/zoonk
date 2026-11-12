import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { getSkillArea } from "../../../plans/planner/graph-areas";
import { parsePlanGraph } from "../../../plans/planner/plan-state";
import { loadListeningExam } from "../../listening/listening-exam";
import { getListeningSkillIds } from "../../listening/listening-skills";
import { getMockFormatMix } from "../mock-format-mix";
import { type MockOption, isOptionArea } from "../mock-options";
import {
  type MockFormatShortfall,
  type MockWritingSkill,
  getMockQuestionsShortfall,
} from "../mock-shortfall";
import { type AnytimeMockSetup } from "./anytime-mock-setup";
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

  const asked = graph.skills.flatMap((skill) => {
    const area = getSkillArea({ graph, skill });
    const inOption = asksAll || isOptionArea({ area, option, structure });
    return inOption && !listening.has(skill.skillId) ? [{ area, id: skill.skillId }] : [];
  });

  const rows = await prisma.skill.findMany({
    select: { id: true, isQuantitative: true },
    where: { id: { in: asked.map((skill) => skill.id) } },
  });

  return asked.map((skill) => ({
    ...skill,
    isQuantitative: rows.find((row) => row.id === skill.id)?.isQuantitative ?? null,
  }));
}

function listWrites({
  mix,
  optionSkills,
  option,
  planned,
  structure,
}: {
  mix: ReturnType<typeof getMockFormatMix>;
  structure: ExamStructure | null;
  optionSkills: readonly MockWritingSkill[];
  option: MockOption;
  planned: Awaited<ReturnType<typeof planFromBank>>;
}): MockFormatShortfall[] {
  return getMockQuestionsShortfall({
    candidates: planned.candidates,
    mix,
    option,
    plan: planned.plan,
    skills: optionSkills,
    structure,
  });
}

export async function planMockWrites({
  goal,
  option,
  setup,
  userId,
}: {
  goal: Goal;
  option: MockOption;
  setup: AnytimeMockSetup;
  userId: string;
}): Promise<MockFormatShortfall[] | null> {
  const [planned, optionSkills] = await Promise.all([
    planFromBank({ goal, option, setup, userId }),
    loadOptionSkills({ goalId: goal.id, option, structure: setup.structure }),
  ]);

  if (!optionSkills) {
    return null;
  }

  return listWrites({
    mix: getMockFormatMix(setup.structure),
    option,
    optionSkills,
    planned,
    structure: setup.structure,
  });
}
