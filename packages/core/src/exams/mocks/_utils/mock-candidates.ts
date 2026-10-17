import "server-only";
import { type Attempt, type Goal, type ItemFormat, type PlanItem, prisma } from "@zoonk/db";
import { GRADABLE_ITEM_FORMATS } from "../../../learner/_utils/choice-items";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { fitsExamChoice, getExamChoiceFormat } from "../../../library/exams/exam-choice-format";
import { getItemAudienceFilter } from "../../../library/items/item-field";
import { type ItemSetPick, listItemSetsForSkills } from "../../../library/items/item-sets";
import { parsePlanGraph } from "../../../plans/planner/plan-state";
import { type MockFormat, getItemFormatKey, getMockFormatMix } from "../mock-format-mix";
import { type MockCandidate } from "../mock-plan";

/** Fewer exam questions than this and the goal's own questions stand in for the exam's. */
const MIN_EXAM_ITEMS = 5;

type AreaPlanItem = Pick<PlanItem, "chapterId" | "lessonId" | "skillId">;

/**
 * Each lesson's area: the area of the graph skill its plan item teaches, or, for a lesson item
 * without one, the area its chapter's other lessons have.
 */
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

/**
 * Each goal skill's exam area, as the plan's graph names it ("Math", "Natural Sciences"). The
 * graph lists the plan's skills; the skills its lessons teach take the area of the plan item
 * that schedules the lesson, so a mock knows the area of every question it may ask.
 */
export async function loadSkillAreas(goalId: string): Promise<Map<string, string>> {
  const plan = await prisma.plan.findUnique({
    select: { graph: true, items: { select: { chapterId: true, lessonId: true, skillId: true } } },
    where: { goalId },
  });

  const graphAreas = new Map(
    parsePlanGraph(plan?.graph).skills.flatMap((skill) =>
      skill.area ? [[skill.skillId, skill.area] as const] : [],
    ),
  );

  const lessonAreas = getLessonAreas({ graphAreas, items: plan?.items ?? [] });

  const lessonSkills = await prisma.lessonSkill.findMany({
    orderBy: { createdAt: "asc" },
    where: { lessonId: { in: [...lessonAreas.keys()] } },
  });

  const taughtAreas = lessonSkills.flatMap((row) => {
    const area = lessonAreas.get(row.lessonId);
    return area ? [[row.skillId, area] as const] : [];
  });

  // A graph skill keeps its own area; a skill several lessons teach takes the first one's.
  return new Map([...taughtAreas.toReversed(), ...graphAreas]);
}

/**
 * The formats a mock asks besides picks, as the exam's notice lists them: a number typed into an
 * answer box (`numeric`), a word or a short answer typed in (`typed`, only questions with the
 * wordings code accepts, so a model grades just the misses).
 */
function listTypedFormats(structure: ExamStructure | null): ItemFormat[] {
  const kinds = new Set(structure?.formats.map((format) => format.kind));

  return [
    ...(kinds.has("numeric") ? (["numeric"] as const) : []),
    ...(kinds.has("shortAnswer") ? (["typed"] as const) : []),
  ];
}

/** Bank questions in the formats a mock asks: picks, and the exam's typed formats. */
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

async function loadItems({
  examBlueprintId,
  itemIds,
  skillIds,
  typed,
}: {
  examBlueprintId: string | null;
  itemIds: readonly string[] | null;
  skillIds: readonly string[];
  typed: readonly ItemFormat[];
}) {
  // A recording's questions are its listening section's (`loadListeningCandidates`), never
  // another section's, a mock picked before it had its recordings included.
  const where = {
    ...getFormatFilter(typed),
    ...(itemIds
      ? { id: { in: [...itemIds] } }
      : { skillId: { in: [...skillIds] }, ...getItemAudienceFilter({ examBlueprintId }) }),
    NOT: { set: { is: { kind: "audio" as const } } },
  };

  const examItems =
    examBlueprintId && !itemIds
      ? await prisma.item.findMany({ orderBy: { id: "asc" }, where: { ...where, examBlueprintId } })
      : [];

  return examItems.length >= MIN_EXAM_ITEMS
    ? examItems
    : prisma.item.findMany({ orderBy: { id: "asc" }, where });
}

type LastAnswer = Omit<Attempt, "answer">;

/**
 * The order a mock asks answered questions again: the ones the learner got wrong last time first,
 * then the ones answered longest ago, so a repeat is worth the most and remembered the least.
 */
function byReuseOrder(first: LastAnswer, second: LastAnswer): number {
  if (first.isCorrect !== second.isCorrect) {
    return first.isCorrect ? 1 : -1;
  }

  return first.answeredAt.getTime() - second.answeredAt.getTime();
}

/** The learner's latest answer to each of these questions they ever answered, in reuse order. */
async function loadLastAnswers({
  itemIds,
  userId,
}: {
  itemIds: readonly string[];
  userId: string;
}): Promise<LastAnswer[]> {
  const answers = await prisma.attempt.findMany({
    distinct: ["itemId"],
    omit: { answer: true },
    orderBy: [{ itemId: "asc" }, { answeredAt: "desc" }],
    where: { itemId: { in: [...itemIds] }, userId },
  });

  return answers.toSorted(byReuseOrder);
}

type BankItem = Awaited<ReturnType<typeof loadItems>>[number];

type CandidateUnit = { answered: boolean; candidates: MockCandidate[]; key: string };

/** A question's place in its set, for a mock rebuilt from the questions it picked (whole sets). */
function toPickedSet({ item, items }: { item: BankItem; items: readonly BankItem[] }) {
  const { setId } = item;

  return setId
    ? {
        id: setId,
        position: item.setPosition ?? 0,
        size: items.filter((other) => other.setId === setId).length,
      }
    : undefined;
}

/**
 * The sets on the mock's skills a mock may ask (a text, a case or a chart several questions read;
 * recordings belong to listening sections), whole: each only when all of its questions are in the
 * exam's formats, its questions in the set's order, all in the area of its first skill that has
 * one, so a set stays in one section.
 */
async function loadSetUnits({
  areas,
  fits,
  goal,
  mix,
  skillIds,
  typed,
  userId,
}: {
  areas: ReadonlyMap<string, string>;
  fits: (item: BankItem) => boolean;
  goal: Pick<Goal, "examBlueprintId">;
  mix: readonly MockFormat[];
  skillIds: readonly string[];
  typed: readonly ItemFormat[];
  userId: string;
}): Promise<CandidateUnit[]> {
  const listed = await listItemSetsForSkills({
    examBlueprintId: goal.examBlueprintId,
    skillIds,
    userId,
  });

  const sets = listed.filter((set) => set.kind !== "audio");

  const rows = await prisma.item.findMany({
    where: {
      AND: [
        getFormatFilter(typed),
        { id: { in: sets.flatMap((set) => set.items.map((item) => item.id)) } },
      ],
    },
  });

  const byId = new Map(rows.map((row) => [row.id, row]));

  return sets.flatMap((set: ItemSetPick): CandidateUnit[] => {
    const members = set.items.flatMap((item) => byId.get(item.id) ?? []);

    if (members.length < set.items.length || !members.every((member) => fits(member))) {
      return [];
    }

    const area = set.skillIds.map((skillId) => areas.get(skillId)).find(Boolean) ?? null;
    const answered = set.lastAnsweredAt !== null;

    const candidates = members.map((member, position) => ({
      answered,
      area,
      difficulty: member.difficulty,
      format: getItemFormatKey({ item: member, mix }),
      itemId: member.id,
      set: { id: set.id, position, size: members.length },
      skillId: member.skillId,
    }));

    return [{ answered, candidates, key: set.id }];
  });
}

/**
 * Questions a mock may ask: questions on the goal's skills (the exam's own when it has enough),
 * in the exam's own formats: its choice format with its number of options (ENEM never asks four
 * options), and the numbers and words typed in that its notice lists, and the sets of questions
 * that read one text whole (see `loadSetUnits`). The ones the learner has never answered come
 * first, sets among them in the order they were written; the ones they answered follow, marked
 * `answered`, the missed ones first and then the ones answered longest ago, then the sets answered
 * longest ago, for a mock to ask again only once it has no new ones left, since repeats inflate
 * the score. With `itemIds`, only those questions, to rebuild the sections of a mock already
 * picked.
 */
export async function loadMockCandidates({
  goal,
  itemIds,
  skillIds,
  structure = null,
  userId,
}: {
  goal: Pick<Goal, "examBlueprintId"> & { id: string | null };
  itemIds: readonly string[] | null;
  skillIds: readonly string[];
  /** The exam the mock copies, whose choice format its questions follow. */
  structure?: ExamStructure | null;
  userId: string;
}): Promise<MockCandidate[]> {
  const typed = listTypedFormats(structure);
  const mix = getMockFormatMix(structure);

  const [loaded, areas] = await Promise.all([
    loadItems({ examBlueprintId: goal.examBlueprintId, itemIds, skillIds, typed }),
    goal.id ? loadSkillAreas(goal.id) : new Map<string, string>(),
  ]);

  const choice = getExamChoiceFormat(structure);

  const items = itemIds
    ? loaded
    : loaded.filter((item) => typed.includes(item.format) || fitsExamChoice({ choice, item }));

  const [answers, sets] = await Promise.all([
    loadLastAnswers({ itemIds: items.map((item) => item.id), userId }),
    itemIds
      ? []
      : loadSetUnits({
          areas,
          fits: (item) => typed.includes(item.format) || fitsExamChoice({ choice, item }),
          goal,
          mix,
          skillIds,
          typed,
          userId,
        }),
  ]);

  const answered = new Set(answers.map((answer) => answer.itemId));
  const byId = new Map(items.map((item) => [item.id, item]));

  const toCandidate = (item: BankItem): MockCandidate => {
    const set = itemIds ? toPickedSet({ item, items }) : undefined;

    return {
      answered: answered.has(item.id),
      area: areas.get(item.skillId) ?? null,
      difficulty: item.difficulty,
      format: getItemFormatKey({ item, mix }),
      itemId: item.id,
      ...(set ? { set } : {}),
      skillId: item.skillId,
    };
  };

  const fresh = [
    ...items
      .filter((item) => !answered.has(item.id))
      .map((item): CandidateUnit => ({
        answered: false,
        candidates: [toCandidate(item)],
        key: item.id,
      })),
    ...sets.filter((set) => !set.answered),
  ].toSorted((first, second) => first.key.localeCompare(second.key));

  return [
    ...fresh.flatMap((unit) => unit.candidates),
    ...answers
      .flatMap((answer) => byId.get(answer.itemId ?? "") ?? [])
      .map((item) => toCandidate(item)),
    ...sets.filter((set) => set.answered).flatMap((set) => set.candidates),
  ];
}
