import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import {
  type ExamPicks,
  findSubjectAreas,
  listChoiceGroups,
  listUnchosenSubjects,
} from "../../exams/choices/exam-choices";
import { type ExamStructure, examStructureSchema } from "../../library/exams/blueprint-contract";
import { getSkillArea } from "../planner/graph-areas";
import {
  addSharedOptionSkills,
  joinOptionSkills,
  setAsideOptionSkills,
} from "../planner/option-skills";
import { type PlanGraph, parsePlanGraph } from "../planner/plan-state";

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
    listChoiceGroups(structure.subjects).flatMap((group) =>
      group.options.flatMap((option) => (untaken.has(option.name) ? [] : [option.name])),
    ),
  );
}

async function addTakenFromSharedGraph({
  examBlueprintId,
  graph,
  structure,
  taken,
}: {
  examBlueprintId: string;
  graph: PlanGraph;
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

  const stored = await prisma.examSkillGraph.findUnique({
    select: { graph: true },
    where: { examBlueprintId },
  });

  const shared = joinOptionSkills(parsePlanGraph(stored?.graph));
  const sharedAreas = findSubjectAreas({ areas: listAreas(shared), names: taken, structure });

  const areas = new Set(
    [...sharedAreas].flatMap(([area, option]) => (missing.includes(option) ? [area] : [])),
  );

  return addSharedOptionSkills({ areas, graph, shared });
}

/** Sets aside the skills of the subjects the learner doesn't take, and brings in the options they do. */
export async function chooseExamOptionSkills({
  goal,
  graph,
  picks,
}: {
  goal: Pick<Goal, "examBlueprintId" | "kind">;
  graph: PlanGraph;
  picks: ExamPicks;
}): Promise<PlanGraph> {
  const blueprint =
    goal.kind === "exam" && goal.examBlueprintId
      ? await prisma.examBlueprint.findUnique({
          select: { id: true, structure: true },
          where: { id: goal.examBlueprintId },
        })
      : null;

  const structure = examStructureSchema.safeParse(blueprint?.structure).data;

  if (!(blueprint && structure)) {
    return joinOptionSkills(graph);
  }

  const untaken = listUnchosenSubjects({ picks, structure });

  const joined = await addTakenFromSharedGraph({
    examBlueprintId: blueprint.id,
    graph: joinOptionSkills(graph),
    structure,
    taken: listTakenOptions({ structure, untaken }),
  });

  const areas = new Set(
    findSubjectAreas({ areas: listAreas(joined), names: untaken, structure }).keys(),
  );

  return setAsideOptionSkills({ areas, graph: joined });
}
