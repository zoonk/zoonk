import "server-only";
import { prisma } from "@zoonk/db";
import { getSkillArea } from "../../../plans/planner/graph-areas";
import { type PlanGraph } from "../../../plans/planner/plan-state";
import { loadListeningExam } from "../../listening/listening-exam";
import { getListeningSkillIds } from "../../listening/listening-skills";
import { listAreaSections } from "../exam-parts";
import { getObjectiveSections } from "../mock-day-sections";
import { getMockFormatMix } from "../mock-format-mix";
import { type MockOption, isOptionArea } from "../mock-options";
import {
  type MockFormatShortfall,
  type MockWritingSkill,
  getMockQuestionsShortfall,
} from "../mock-shortfall";
import { type AnytimeMockSetup } from "./anytime-mock-setup";
import { type planFromBank } from "./plan-from-bank";

export async function loadMockWriteSkills({
  goalId,
  graph,
}: {
  goalId: string;
  graph: PlanGraph;
}): Promise<MockWritingSkill[]> {
  const exam = await loadListeningExam(goalId);
  const listening = getListeningSkillIds({ exam, graph });

  const asked = graph.skills.flatMap((skill) =>
    listening.has(skill.skillId)
      ? []
      : [{ area: getSkillArea({ graph, skill }), id: skill.skillId }],
  );

  const rows = await prisma.skill.findMany({
    select: { id: true, isQuantitative: true },
    where: { id: { in: asked.map((skill) => skill.id) } },
  });

  return asked.map((skill) => ({
    ...skill,
    isQuantitative: rows.find((row) => row.id === skill.id)?.isQuantitative ?? null,
  }));
}

export function planMockWrites({
  planned,
  option,
  skills,
  setup,
}: {
  planned: Awaited<ReturnType<typeof planFromBank>>;
  option: Pick<MockOption, "questions" | "kind" | "area" | "areas" | "day">;
  skills: readonly MockWritingSkill[];
  setup: AnytimeMockSetup;
}): MockFormatShortfall[] {
  const { structure } = setup;

  const inDay = new Set(
    getObjectiveSections(structure)
      .filter(({ day }) => day === option.day)
      .map(({ name }) => name),
  );

  const mapped = skills.map((skill) => ({
    sections: skill.area ? listAreaSections({ area: skill.area, structure }) : [],
    skill,
  }));

  const byDay = mapped.some(({ sections }) => sections.length > 0);

  const selected = mapped.flatMap(({ skill, sections }) => {
    if (option.kind === "area") {
      return skill.area && isOptionArea({ area: skill.area, option, structure }) ? [skill] : [];
    }

    return inDay.size === 0 || !byDay || sections.some((name) => inDay.has(name)) ? [skill] : [];
  });

  return getMockQuestionsShortfall({
    candidates: planned.reuse
      ? planned.candidates.map((candidate) => ({ ...candidate, answered: false }))
      : planned.candidates,
    mix: getMockFormatMix(structure),
    onlyMissing: planned.reuse,
    option,
    plan: { ...planned.plan, reused: 0 },
    skills: selected,
    structure,
  });
}
