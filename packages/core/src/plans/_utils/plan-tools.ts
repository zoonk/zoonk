import "server-only";
import { type ExamBlueprint, type Goal, type PlanItemStatus, prisma } from "@zoonk/db";
import { getToolKey, parseChapterTools } from "../../library/chapters/chapter-tools";
import { examStructureSchema } from "../../library/exams/blueprint-contract";
import { type PlanToolView } from "../plan-view-contract";
import { type PlanGraph, type PlanSettings } from "../planner/plan-state";
import { type PlanReadContext } from "./plan-read-projection";

export type PlanTool = {
  chapterIds: string[];
  essential: boolean;
  isPrivate: boolean;
  key: string;
  later: boolean;
  name: string;
};

const LEFT_OUT: ReadonlySet<PlanItemStatus> = new Set(["skipped", "testedOut"]);

function getPlanChapters(items: PlanReadContext["items"]) {
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

export async function goalUsesTools(
  goal: Pick<Goal, "examBlueprintId" | "kind">,
  known?: Pick<ExamBlueprint, "structure"> | null,
): Promise<boolean> {
  if (goal.kind !== "exam" || !goal.examBlueprintId) {
    return usesTools({ examStructure: null, kind: goal.kind });
  }

  const blueprint =
    known === undefined
      ? await prisma.examBlueprint.findUnique({
          select: { structure: true },
          where: { id: goal.examBlueprintId },
        })
      : known;

  return usesTools({ examStructure: blueprint?.structure, kind: goal.kind });
}

export async function loadPlanTools({
  currentPhase,
  goal,
  items,
}: {
  currentPhase: number | null;
  goal: Pick<Goal, "examBlueprintId" | "kind">;
  items: PlanReadContext["items"];
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
