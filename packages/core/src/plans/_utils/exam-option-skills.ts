import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { getWrittenTasks } from "../../exams/_utils/written-tasks";
import { listChoiceGroups } from "../../exams/choices/choice-groups";
import {
  type ExamPicks,
  findSubjectAreas,
  listUnchosenSubjects,
} from "../../exams/choices/exam-choices";
import { sizeLegacyExamSkills } from "../../library/curriculum/legacy-exam-estimates";
import { prunePlanNoticeGraph } from "../../library/curriculum/prune-plan-notice-graph";
import { type ExamStructure, examStructureSchema } from "../../library/exams/blueprint-contract";
import { getSkillArea } from "../planner/graph-areas";
import {
  addSharedOptionSkills,
  joinOptionSkills,
  setAsideOptionSkills,
} from "../planner/option-skills";
import { type PlanGraph, type PlanGraphSkill, parsePlanGraph } from "../planner/plan-state";

function listAreas(graph: PlanGraph): string[] {
  return [...new Set(graph.skills.map((skill) => getSkillArea({ graph, skill })))];
}

function listTakenOptions({
  structure,
  untaken,
}: {
  structure: ExamStructure;
  untaken: ReadonlySet<string>;
}): Set<string> {
  return new Set(
    listChoiceGroups(structure).flatMap((group) =>
      group.options.flatMap((option) => (untaken.has(option.name) ? [] : [option.name])),
    ),
  );
}

async function addTakenFromSharedGraph({
  graph,
  shared,
  structure,
  taken,
}: {
  graph: PlanGraph;
  shared: PlanGraph;
  structure: ExamStructure;
  taken: ReadonlySet<string>;
}): Promise<PlanGraph> {
  const taught = new Set(
    findSubjectAreas({ areas: listAreas(graph), names: taken, structure }).values(),
  );

  const missing = [...taken].filter((name) => !taught.has(name));

  if (missing.length === 0) {
    return graph;
  }

  const { graph: source } = await prunePlanNoticeGraph({
    graph: shared,
    subjects: structure.subjects.map((subject) => ({
      ...subject,
      writtenTasks: getWrittenTasks({ structure, subject }),
    })),
  });

  const sharedAreas = findSubjectAreas({ areas: listAreas(source), names: taken, structure });

  const areas = new Set(
    [...sharedAreas].flatMap(([area, option]) => (missing.includes(option) ? [area] : [])),
  );

  return addSharedOptionSkills({ areas, graph, shared: source });
}

function applySharedSizes(graph: PlanGraph, shared: PlanGraph): PlanGraph {
  const estimates = new Map(
    [...shared.skills, ...(shared.extraSkills ?? [])].map((skill) => [
      skill.skillId,
      skill.lessons,
    ]),
  );

  const size = <Skill extends PlanGraphSkill>(skill: Skill): Skill => ({
    ...skill,
    lessons: estimates.get(skill.skillId) ?? skill.lessons,
  });

  return {
    ...graph,
    ...(graph.extraSkills && { extraSkills: graph.extraSkills.map(size) }),
    ...(graph.optionSkills && { optionSkills: graph.optionSkills.map(size) }),
    skills: graph.skills.map(size),
  };
}

export async function loadExamOptionSource(goal: Pick<Goal, "examBlueprintId" | "kind">) {
  return goal.kind === "exam" && goal.examBlueprintId
    ? prisma.examBlueprint.findUnique({
        select: { skillGraph: { select: { graph: true } }, structure: true },
        where: { id: goal.examBlueprintId },
      })
    : null;
}

/** Sets aside the skills of the subjects the learner doesn't take, and brings in the options they do. */
export async function chooseExamOptionSkills({
  goal,
  graph,
  picks,
  readSource = () => loadExamOptionSource(goal),
}: {
  goal: Pick<Goal, "examBlueprintId" | "kind">;
  graph: PlanGraph;
  picks: ExamPicks;
  readSource?: () => ReturnType<typeof loadExamOptionSource>;
}): Promise<PlanGraph> {
  const blueprint = await readSource();
  const structure = examStructureSchema.safeParse(blueprint?.structure).data;

  const shared = sizeLegacyExamSkills(
    joinOptionSkills(parsePlanGraph(blueprint?.skillGraph?.graph)),
  );

  const personal = joinOptionSkills(graph);

  if (!blueprint?.skillGraph && !structure) {
    return personal;
  }

  if (!structure) {
    return applySharedSizes(personal, shared);
  }

  const untaken = listUnchosenSubjects({ picks, structure });

  const joined = await addTakenFromSharedGraph({
    graph: personal,
    shared,
    structure,
    taken: listTakenOptions({ structure, untaken }),
  });

  const areas = new Set(
    findSubjectAreas({ areas: listAreas(joined), names: untaken, structure }).keys(),
  );

  return applySharedSizes(setAsideOptionSkills({ areas, graph: joined }), shared);
}
