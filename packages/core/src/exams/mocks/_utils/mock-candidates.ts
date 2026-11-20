import "server-only";
import {
  type Goal,
  type ItemFormat,
  type Plan,
  type PlanItem,
  type TransactionClient,
  prisma,
} from "@zoonk/db";
import { GRADABLE_ITEM_FORMATS } from "../../../learner/_utils/choice-items";
import { getLessonSkillRows, toIdKey } from "../../../library/_utils/shared-rows";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { fitsExamChoice, getExamChoiceFormats } from "../../../library/exams/exam-choice-format";
import { parsePlanGraph } from "../../../plans/planner/plan-state";
import { getItemFormatKey, getMockFormatMix } from "../mock-format-mix";
import { type MockCandidate } from "../mock-plan";
import { listMockItemClaims } from "./mock-item-uses";

type AreaPlanItem = Pick<PlanItem, "chapterId" | "lessonId" | "skillId">;

function getLessonAreas({
  graphAreas,
  items,
}: {
  graphAreas: ReadonlyMap<string, string>;
  items: readonly AreaPlanItem[];
}): Map<string, string> {
  const areaOf = (item: AreaPlanItem) => (item.skillId ? graphAreas.get(item.skillId) : undefined);

  const chapterAreas = new Map(
    items.flatMap((item) => {
      const area = areaOf(item);
      return item.chapterId && area ? [[item.chapterId, area] as const] : [];
    }),
  );

  return new Map(
    items.flatMap((item) => {
      const area = areaOf(item) ?? (item.chapterId ? chapterAreas.get(item.chapterId) : undefined);
      return item.lessonId && area ? [[item.lessonId, area] as const] : [];
    }),
  );
}

async function loadAreaLessonSkills({
  known,
  lessonIds,
}: {
  known?: { items: Pick<PlanItem, "lessonId">[] };
  lessonIds: readonly string[];
}) {
  if (known) {
    const wanted = new Set(lessonIds);
    const rows = await getLessonSkillRows(toIdKey(known.items.map((item) => item.lessonId)));
    return rows.filter((row) => wanted.has(row.lessonId));
  }

  return prisma.lessonSkill.findMany({
    orderBy: { createdAt: "asc" },
    select: { lessonId: true, skillId: true },
    where: { lessonId: { in: [...lessonIds] } },
  });
}

export async function loadSkillAreas(
  goalId: string,
  known?: Pick<Plan, "graph"> & { items: Pick<PlanItem, "chapterId" | "lessonId" | "skillId">[] },
): Promise<Map<string, string>> {
  const plan =
    known ??
    (await prisma.plan.findUnique({
      select: {
        graph: true,
        items: { select: { chapterId: true, lessonId: true, skillId: true } },
      },
      where: { goalId },
    }));

  const graphAreas = new Map(
    parsePlanGraph(plan?.graph).skills.flatMap((skill) =>
      skill.area ? [[skill.skillId, skill.area] as const] : [],
    ),
  );

  const lessonAreas = getLessonAreas({ graphAreas, items: plan?.items ?? [] });

  const lessonSkills = await loadAreaLessonSkills({ known, lessonIds: [...lessonAreas.keys()] });

  const taughtAreas = lessonSkills.flatMap((row) => {
    const area = lessonAreas.get(row.lessonId);
    return area ? [[row.skillId, area] as const] : [];
  });

  return new Map([...taughtAreas.toReversed(), ...graphAreas]);
}

function listTypedFormats(structure: ExamStructure | null): ItemFormat[] {
  const kinds = new Set(structure?.formats.map((format) => format.kind));

  return [
    ...(kinds.has("numeric") ? (["numeric"] as const) : []),
    ...(kinds.has("shortAnswer") ? (["typed"] as const) : []),
  ];
}

export function getFormatFilter(typed: readonly ItemFormat[]) {
  return {
    OR: [
      {
        format: { in: [...GRADABLE_ITEM_FORMATS, ...typed.filter((format) => format !== "typed")] },
      },
      ...(typed.includes("typed")
        ? [
            {
              NOT: { content: { equals: [], path: ["acceptedAnswers"] } },
              format: "typed" as const,
            },
          ]
        : []),
    ],
  };
}

export async function loadMockCandidates({
  client = prisma,
  goal,
  itemIds,
  plan,
  skillIds,
  structure = null,
  userId,
  reuse = false,
  now = new Date(),
}: {
  client?: TransactionClient;
  goal: Pick<Goal, "examBlueprintId"> & { id: string | null };
  itemIds: readonly string[] | null;
  plan?: Parameters<typeof loadSkillAreas>[1];
  skillIds: readonly string[];
  structure?: ExamStructure | null;
  userId: string;
  reuse?: boolean;
  now?: Date;
}): Promise<MockCandidate[]> {
  const typed = listTypedFormats(structure);
  const mix = getMockFormatMix(structure);
  const choices = getExamChoiceFormats(structure);

  const [items, areas] = await Promise.all([
    client.item.findMany({
      include: {
        mockUses: { select: { mockExamId: true, section: true, spentAt: true }, where: { userId } },
        set: { select: { _count: { select: { items: true } } } },
      },
      orderBy: { id: "asc" },
      where: {
        ...getFormatFilter(typed),
        ...(itemIds
          ? { id: { in: [...itemIds] } }
          : {
              NOT: { set: { is: { kind: "audio" } } },
              examBlueprintId: goal.examBlueprintId,
              mockOnly: true,
              retiredAt: null,
              skillId: { in: [...skillIds] },
            }),
      },
    }),
    goal.id ? loadSkillAreas(goal.id, plan) : new Map<string, string>(),
  ]);

  const mockIds = new Set(
    items.flatMap((item) =>
      item.mockUses
        .filter((use) => use.section > 0 && (!use.spentAt || reuse))
        .map((use) => use.mockExamId),
    ),
  );

  const claims =
    !itemIds && mockIds.size > 0
      ? await listMockItemClaims(client, userId, [...mockIds], now)
      : null;

  return items
    .filter((item) => {
      const use = item.mockUses[0];

      return (
        itemIds ||
        (!claims?.held.has(item.id) &&
          (!use ||
            (!use.spentAt && claims?.expired.has(use.mockExamId)) ||
            (reuse && use.spentAt && use.spentAt <= now)) &&
          (typed.includes(item.format) || fitsExamChoice({ choices, item })))
      );
    })
    .map((item) => ({
      answered: Boolean(item.mockUses[0]?.spentAt),
      area: areas.get(item.skillId) ?? null,
      difficulty: item.difficulty,
      format: getItemFormatKey({ item, mix }),
      itemFormat: item.format,
      itemId: item.id,
      lastMockUse: item.mockUses[0]?.spentAt?.getTime(),
      skillId: item.skillId,
      ...(item.set &&
        item.setId && {
          set: { id: item.setId, position: item.setPosition ?? 0, size: item.set._count.items },
        }),
    }));
}
