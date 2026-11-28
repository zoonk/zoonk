import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { getWrittenTaskOptions } from "../../exams/_utils/written-tasks";
import { listChoiceGroups } from "../../exams/choices/choice-groups";
import {
  type ExamPicks,
  findSubjectAreas,
  listUnchosenSubjects,
} from "../../exams/choices/exam-choices";
import { prunePlanNoticeGraph } from "../../library/curriculum/prune-plan-notice-graph";
import { type ExamStructure, examStructureSchema } from "../../library/exams/blueprint-contract";
import { getSkillArea } from "../planner/graph-areas";
import {
  addSharedOptionSkills,
  getOptionSkillSubject,
  joinOptionSkills,
  setAsideOptionSkills,
} from "../planner/option-skills";
import { type PlanGraph, type PlanGraphSkill, parsePlanGraph } from "../planner/plan-state";

function matchOptionAreas({
  graph,
  names,
  structure,
}: {
  graph: PlanGraph;
  names: ReadonlySet<string>;
  structure: ExamStructure;
}) {
  const areas = [...new Set(graph.skills.map((skill) => getSkillArea({ graph, skill })))];
  const sectionNames = new Set(getWrittenTaskOptions(structure).map((task) => task.section));

  return findSubjectAreas({
    areas: areas.filter((area) => !sectionNames.has(area) || names.has(area)),
    names,
    structure,
  });
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
  const subjectsByArea = matchOptionAreas({ graph, names: taken, structure });

  const taught = new Set(
    graph.skills.map((skill) => getOptionSkillSubject({ graph, skill, subjectsByArea })),
  );

  const missing = new Set([...taken].filter((name) => !taught.has(name)));

  if (missing.size === 0) {
    return graph;
  }

  const { graph: source } = await prunePlanNoticeGraph({
    graph: shared,
    subjects: structure.subjects,
  });

  const available = joinOptionSkills(source);

  return addSharedOptionSkills({
    areas: missing,
    graph,
    shared: available,
    subjectsByArea: matchOptionAreas({ graph: available, names: missing, structure }),
  });
}

function applySharedSizes(graph: PlanGraph, shared: PlanGraph): PlanGraph {
  const estimates = new Map(
    [...shared.skills, ...(shared.extraSkills ?? [])].map((skill) => [
      skill.skillId,
      skill.domain?.estimate ?? skill.lessons,
    ]),
  );

  const size = <Skill extends PlanGraphSkill>(skill: Skill): Skill => {
    const estimate = estimates.get(skill.skillId);

    if (estimate === undefined) {
      return skill;
    }

    return skill.domain
      ? { ...skill, domain: { ...skill.domain, estimate } }
      : { ...skill, lessons: estimate };
  };

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
  const shared = joinOptionSkills(parsePlanGraph(blueprint?.skillGraph?.graph));
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

  return applySharedSizes(
    setAsideOptionSkills({
      areas: untaken,
      graph: joined,
      subjectsByArea: matchOptionAreas({ graph: joined, names: untaken, structure }),
    }),
    shared,
  );
}
