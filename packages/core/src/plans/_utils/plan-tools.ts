import "server-only";
import { type Goal, type PlanItemStatus, prisma } from "@zoonk/db";
import { getToolKey, parseChapterTools } from "../../library/chapters/chapter-tools";
import { examStructureSchema } from "../../library/exams/blueprint-contract";
import { type PlanToolView } from "../plan-view-contract";
import { type PlanGraph, type PlanSettings } from "../planner/plan-state";
import { type PlanContext } from "./plan-context";

/**
 * A tool the plan's chapters use: essential when any of them needs it, the chapters that use it
 * in plan order, and whether only private chapters name it (a company's own tool, say).
 */
export type PlanTool = {
  chapterIds: string[];
  essential: boolean;
  isPrivate: boolean;
  key: string;
  /** No chapter of the phase the learner is in uses it yet: the card lists it under "More later". */
  later: boolean;
  name: string;
};

/** Chapters the learner tested out of or skipped no longer need their tools. */
const LEFT_OUT: ReadonlySet<PlanItemStatus> = new Set(["skipped", "testedOut"]);

function getPlanChapters(items: PlanContext["items"]) {
  const phaseByChapter = items
    .filter((item) => !LEFT_OUT.has(item.status))
    .reduce(
      (phases, item) =>
        item.chapterId && !phases.has(item.chapterId)
          ? phases.set(item.chapterId, item.phase)
          : phases,
      new Map<string, number>(),
    );

  return { chapterIds: [...phaseByChapter.keys()], phaseByChapter };
}

/**
 * Whether a goal practices with tools of their own, from its kind and its exam's stored structure
 * (`ExamBlueprint.structure`, null without a blueprint). An exam is answered on paper or on
 * screen, so a shared course's chapters that practice with a spreadsheet, a data tool or a
 * schematic editor (for learners at work) teach beyond what it asks: its plan leaves out the
 * chapters that need one and asks about no tool, unless the exam itself is a practical one.
 */
export function usesTools({
  examStructure,
  kind,
}: {
  examStructure: unknown;
  kind: Goal["kind"];
}): boolean {
  if (kind !== "exam") {
    return true;
  }

  const formats = examStructureSchema.safeParse(examStructure).data?.formats ?? [];
  return formats.some((format) => format.kind === "practical");
}

/** Whether the learner's goal practices with tools of their own (see `usesTools`). */
export async function goalUsesTools(
  goal: Pick<Goal, "examBlueprintId" | "kind">,
): Promise<boolean> {
  if (goal.kind !== "exam" || !goal.examBlueprintId) {
    return usesTools({ examStructure: null, kind: goal.kind });
  }

  const blueprint = await prisma.examBlueprint.findUnique({
    select: { structure: true },
    where: { id: goal.examBlueprintId },
  });

  return usesTools({ examStructure: blueprint?.structure, kind: goal.kind });
}

/**
 * The tools of the plan's chapters, one entry per tool: the ones the learner's current phase uses
 * first (essential ones first), then the ones later phases use, in the order the plan reaches them.
 * None for an exam that isn't practical (see `goalUsesTools`).
 */
export async function loadPlanTools({
  currentPhase,
  goal,
  items,
}: {
  /** The phase the learner is in (see `findCurrentPhase`). */
  currentPhase: number | null;
  goal: Pick<Goal, "examBlueprintId" | "kind">;
  items: PlanContext["items"];
}): Promise<PlanTool[]> {
  if (!(await goalUsesTools(goal))) {
    return [];
  }

  const { chapterIds, phaseByChapter } = getPlanChapters(items);

  const chapters = await prisma.chapter.findMany({
    select: { id: true, ownerId: true, tools: true },
    where: { id: { in: chapterIds } },
  });

  const byId = new Map(chapters.map((chapter) => [chapter.id, chapter]));

  const uses = chapterIds.flatMap((chapterId) => {
    const chapter = byId.get(chapterId);

    return parseChapterTools(chapter?.tools).map((tool) => ({
      chapterId,
      isPrivate: chapter?.ownerId !== null,
      key: getToolKey(tool.name),
      tool,
    }));
  });

  const tools = [...new Set(uses.map((use) => use.key))].map((key) => {
    const own = uses.filter((use) => use.key === key);

    return {
      chapterIds: [...new Set(own.map((use) => use.chapterId))],
      essential: own.some((use) => use.tool.essential),
      isPrivate: own.every((use) => use.isPrivate),
      key,
      later: own.every((use) => (phaseByChapter.get(use.chapterId) ?? 0) > (currentPhase ?? 0)),
      name: own[0]?.tool.name ?? key,
    };
  });

  return tools.toSorted(
    (a, b) => Number(a.later) - Number(b.later) || Number(b.essential) - Number(a.essential),
  );
}

/** The "You'll use" card: each tool with what the learner chose for it, if anything yet. */
export function toPlanToolViews({
  settings,
  tools,
}: {
  settings: PlanSettings;
  tools: readonly PlanTool[];
}): PlanToolView[] {
  return tools.map((tool) => {
    const chosen = settings.tools.find((choice) => getToolKey(choice.name) === tool.key);

    return {
      choice: chosen?.choice ?? null,
      essential: tool.essential,
      later: tool.later,
      name: tool.name,
      system: chosen?.system ?? null,
    };
  });
}

/**
 * The first skill, in teaching order, that the tool's chapters teach: a setup lesson goes right
 * before it. Null when the graph has none of them, which puts the lesson at the plan's start.
 */
export async function findToolAnchorSkill({
  chapterIds,
  graph,
}: {
  chapterIds: readonly string[];
  graph: PlanGraph;
}): Promise<string | null> {
  const where = { chapterId: { in: [...chapterIds] } };

  const [lessonSkills, chapterSkills] = await Promise.all([
    prisma.lessonSkill.findMany({
      select: { skillId: true },
      where: { lesson: { chapters: { some: where } } },
    }),
    prisma.chapterSkill.findMany({ select: { skillId: true }, where }),
  ]);

  const taught = new Set([...lessonSkills, ...chapterSkills].map((row) => row.skillId));

  return graph.skills.find((skill) => taught.has(skill.skillId))?.skillId ?? null;
}
