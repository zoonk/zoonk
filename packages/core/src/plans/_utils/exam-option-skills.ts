import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import {
  type ExamChoice,
  findChoiceOption,
  findOptionAreas,
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

/** The options the learner picked of the exam's choices, by the notice's names. */
function listPickedOptions({
  choices,
  structure,
}: {
  choices: readonly ExamChoice[];
  structure: ExamStructure;
}): string[] {
  return choices.flatMap((choice) => findChoiceOption({ choice, structure })?.name ?? []);
}

/**
 * The picked options' skills from the exam's shared graph for a plan whose graph has none of them:
 * one built before the exam's graph had its options (ENEM's languages, read later). A plan whose
 * graph has every picked option is returned as it is, without reading the shared graph.
 */
async function addPickedFromSharedGraph({
  choices,
  examBlueprintId,
  graph,
  structure,
}: {
  choices: readonly ExamChoice[];
  examBlueprintId: string;
  graph: PlanGraph;
  structure: ExamStructure;
}): Promise<PlanGraph> {
  const taught = new Set(findOptionAreas({ areas: listAreas(graph), structure }).values());
  const missing = listPickedOptions({ choices, structure }).filter((name) => !taught.has(name));

  if (missing.length === 0) {
    return graph;
  }

  const stored = await prisma.examSkillGraph.findUnique({
    select: { graph: true },
    where: { examBlueprintId },
  });

  const shared = joinOptionSkills(parsePlanGraph(stored?.graph));
  const sharedAreas = findOptionAreas({ areas: listAreas(shared), structure });

  const areas = new Set(
    [...sharedAreas].flatMap(([area, option]) => (missing.includes(option) ? [area] : [])),
  );

  return addSharedOptionSkills({ areas, graph, shared });
}

/**
 * The graph a plan studies from: only the options the learner takes of their exam's choices (the
 * language of ENEM's or the Rio Branco exam's choice, an elective). The skills of every other
 * option, and of a choice not picked yet, are set aside with the plan (see `setAsideOptionSkills`),
 * so the plan, practice, placement, mocks and the syllabus never teach or count them; a new pick
 * brings its option's skills back in their place, from the exam's shared graph when the plan never
 * had them. A goal without an exam notice keeps its whole graph.
 */
export async function chooseExamOptionSkills({
  choices,
  goal,
  graph,
}: {
  choices: readonly ExamChoice[];
  goal: Pick<Goal, "examBlueprintId" | "kind">;
  graph: PlanGraph;
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

  const joined = await addPickedFromSharedGraph({
    choices,
    examBlueprintId: blueprint.id,
    graph: joinOptionSkills(graph),
    structure,
  });

  const unchosen = listUnchosenSubjects({ choices, structure });
  const optionAreas = findOptionAreas({ areas: listAreas(joined), structure });

  const areas = new Set(
    [...optionAreas].flatMap(([area, option]) => (unchosen.has(option) ? [area] : [])),
  );

  return setAsideOptionSkills({ areas, graph: joined });
}
