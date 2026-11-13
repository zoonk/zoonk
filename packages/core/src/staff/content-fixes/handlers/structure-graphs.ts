import { type TransactionClient, sql } from "@zoonk/db";
import { z } from "zod";
import { writeSharedExamGraph } from "../../../library/curriculum/reusable-curriculum";
import { type PlanGraph, planGraphSchema } from "../../../plans/planner/plan-state";
import { type Json, toJson } from "../_utils/resolved-change";
import { collectionHandler } from "./collection-handler";
import { idSchema } from "./fix-handler";

const MAX_GRAPH_WEIGHT = 5;

const graphSchema = z.strictObject({
  graph: planGraphSchema.strict(),
  primaryCourseId: idSchema.nullable().optional(),
});

async function graphProblem(
  db: TransactionClient,
  graph: PlanGraph,
  primaryCourseId: string | null,
  language: string | null,
  previous: Json,
): Promise<string | undefined> {
  const skills = [...graph.skills, ...(graph.optionSkills ?? [])];
  const ids = skills.map((skill) => skill.skillId);

  const invalidShape = graphShapeProblem(graph);

  if (invalidShape) {
    return invalidShape;
  }

  const courseIds = [
    ...new Set([
      ...(primaryCourseId ? [primaryCourseId] : []),
      ...skills.flatMap((skill) => skill.courseIds ?? []),
      ...(graph.courseOutline ? [graph.courseOutline.courseId] : []),
    ]),
  ];

  const referenceProblem = graphReferenceProblem(graph, [...ids, ...courseIds]);

  if (referenceProblem) {
    return referenceProblem;
  }

  const [rows, courses] = await Promise.all([
    db.skill.findMany({ where: { id: { in: ids } } }),
    db.course.findMany({ where: { id: { in: courseIds } } }),
  ]);

  if (rows.length !== ids.length || courses.length !== courseIds.length) {
    return "Every graph skill and course must exist.";
  }

  const merged = rows.find((skill) => skill.mergedIntoId);

  if (merged) {
    return `Use surviving Skill ${merged.mergedIntoId}.`;
  }

  if (
    rows.some((row) => row.ownerId || row.visibility !== "public") ||
    courses.some((row) => row.userId || row.visibility !== "public")
  ) {
    return "Every graph skill and course must be public with no owner.";
  }

  if (await changedLanguage(db, previous, rows)) {
    return "A graph keeps its language and target language.";
  }

  const root = rows[0];

  if (
    !root ||
    (language && root.language !== language) ||
    rows.some(
      (row) => row.language !== root.language || row.targetLanguage !== root.targetLanguage,
    ) ||
    courses.some(
      (row) => row.language !== root.language || row.targetLanguage !== root.targetLanguage,
    )
  ) {
    return "Graph skills and courses must share language and target language.";
  }

  return outlineProblem(db, graph);
}

function graphShapeProblem(graph: PlanGraph): string | undefined {
  const skills = [...graph.skills, ...(graph.optionSkills ?? [])];
  const ids = skills.map((skill) => skill.skillId);

  if (ids.length === 0 || new Set(ids).size !== ids.length) {
    return "The graph needs unique skills and at least one skill.";
  }

  if (
    skills.some(
      (skill) =>
        skill.phase >= graph.phases.length ||
        (skill.weight !== null &&
          (!Number.isInteger(skill.weight) || skill.weight < 1 || skill.weight > MAX_GRAPH_WEIGHT)),
    )
  ) {
    return "A graph skill needs a phase in range and weight null or 1–5.";
  }

  if (graph.optionSkills?.some((skill) => skill.after !== null && !ids.includes(skill.after))) {
    return "optionSkills.after must name a skill in the graph.";
  }

  return undefined;
}

function graphReferenceProblem(graph: PlanGraph, ids: readonly string[]): string | undefined {
  const chapterId = graph.courseOutline?.startChapterId;

  if ([...ids, ...(chapterId ? [chapterId] : [])].some((id) => !idSchema.safeParse(id).success)) {
    return "Every graph reference must be a valid UUID.";
  }

  const skills = [...graph.skills, ...(graph.optionSkills ?? [])];

  return skills.some((skill) => new Set(skill.courseIds).size !== (skill.courseIds ?? []).length)
    ? "A graph skill's course ids must be unique."
    : undefined;
}

async function changedLanguage(
  db: TransactionClient,
  previous: Json,
  rows: readonly { language: string; targetLanguage: string | null }[],
): Promise<boolean> {
  const old = planGraphSchema.safeParse(previous);
  const id = old.success ? old.data.skills[0]?.skillId : undefined;

  const skill =
    id && idSchema.safeParse(id).success ? await db.skill.findUnique({ where: { id } }) : null;

  return (
    skill !== null &&
    rows.some(
      (row) => row.language !== skill.language || row.targetLanguage !== skill.targetLanguage,
    )
  );
}

async function outlineProblem(
  db: TransactionClient,
  graph: PlanGraph,
): Promise<string | undefined> {
  const outline = graph.courseOutline;

  if (outline && outline.startChapterId) {
    const placement = await db.courseChapter.findUnique({
      where: {
        courseId_chapterId: { chapterId: outline.startChapterId, courseId: outline.courseId },
      },
    });

    if (!placement) {
      return "The graph's start chapter must belong to its outline course.";
    }
  }

  return undefined;
}

const GRAPH_RULES =
  "setGraph: { graph, primaryCourseId? }, the whole plan graph. Its skills and courses are public, unmerged and in its language; phases, weights (1-5 or null) and option skills are checked. Existing plans keep their graph copies; only future plans use it.";

export const examGraph = collectionHandler({
  load: async (db, id, value) => {
    const next = graphSchema.parse(value);

    const row = await db.examSkillGraph.findUnique({
      include: { examBlueprint: { select: { language: true, ownerId: true, visibility: true } } },
      where: { id },
    });

    if (!row) {
      return null;
    }

    const primaryCourseId =
      next.primaryCourseId === undefined ? row.primaryCourseId : next.primaryCourseId;

    return {
      before: toJson({
        graph: row.graph,
        ...(next.primaryCourseId === undefined ? {} : { primaryCourseId: row.primaryCourseId }),
      }),
      effects: [{ kind: "existingPlanGraphsKept" as const }],
      problem:
        row.examBlueprint.ownerId || row.examBlueprint.visibility !== "public"
          ? "The exam blueprint must be public with no owner."
          : await graphProblem(
              db,
              next.graph,
              primaryCourseId,
              row.examBlueprint.language,
              toJson(row.graph),
            ),
      roots: { blueprintIds: [row.examBlueprintId] },
      unit: { id, kind: "examSkillGraph" },
    };
  },
  model: "ExamSkillGraph",
  op: "setGraph",
  rules: GRAPH_RULES,
  schema: graphSchema,
  table: sql`exam_skill_graphs`,
  write: async (tx, id, value) => {
    const row = await tx.examSkillGraph.findUniqueOrThrow({ where: { id } });
    const next = graphSchema.parse(value);
    await writeSharedExamGraph(tx, { ...row, ...next });
  },
});

export const languageGraph = collectionHandler({
  load: async (db, id, value) => {
    const next = graphSchema.parse(value);
    const row = await db.languageSkillGraph.findUnique({ where: { id } });

    if (!row) {
      return null;
    }

    const primaryCourseId =
      next.primaryCourseId === undefined ? row.primaryCourseId : next.primaryCourseId;

    return {
      before: toJson({
        graph: row.graph,
        ...(next.primaryCourseId === undefined ? {} : { primaryCourseId: row.primaryCourseId }),
      }),
      effects: [{ kind: "existingPlanGraphsKept" as const }],
      problem: await graphProblem(db, next.graph, primaryCourseId, null, toJson(row.graph)),
      roots: {},
      unit: { id, kind: "languageSkillGraph" },
    };
  },
  model: "LanguageSkillGraph",
  op: "setGraph",
  rules: GRAPH_RULES,
  schema: graphSchema,
  table: sql`language_skill_graphs`,
  write: async (tx, id, value) => {
    await tx.languageSkillGraph.update({ data: graphSchema.parse(value), where: { id } });
  },
});
