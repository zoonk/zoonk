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
import { type PlanGraph, parsePlanGraph } from "../planner/plan-state";

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
  const subjectsByArea = matchOptionAreas({ graph, names: taken, structure });

  const taught = new Set(
    graph.skills.map((skill) => getOptionSkillSubject({ graph, skill, subjectsByArea })),
  );

  const missing = new Set([...taken].filter((name) => !taught.has(name)));

  if (missing.size === 0) {
    return graph;
  }

  const stored = await prisma.examSkillGraph.findUnique({
    select: { graph: true },
    where: { examBlueprintId },
  });

  const { graph: source } = await prunePlanNoticeGraph({
    graph: parsePlanGraph(stored?.graph),
    subjects: structure.subjects,
  });

  const shared = joinOptionSkills(source);

  return addSharedOptionSkills({
    areas: missing,
    graph,
    shared,
    subjectsByArea: matchOptionAreas({ graph: shared, names: missing, structure }),
  });
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

  return setAsideOptionSkills({
    areas: untaken,
    graph: joined,
    subjectsByArea: matchOptionAreas({ graph: joined, names: untaken, structure }),
  });
}
