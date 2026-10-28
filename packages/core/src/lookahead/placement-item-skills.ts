import "server-only";
import {
  type CourseLevel,
  type ExamBlueprint,
  type Goal,
  type ItemFormat,
  prisma,
} from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { toListeningExam } from "../exams/listening/listening-exam";
import { getListeningSkillIds } from "../exams/listening/listening-skills";
import {
  getKnownSubjects,
  getOwnLevel,
  isPlacementSkipped,
} from "../learner/placement/placement-contract";
import { pickPlacementItemSkillIds } from "../learner/placement/placement-item-picks";
import { isOwnMaterialTest } from "../learner/placement/placement-material";
import {
  type PlacementQuickFormat,
  confirmsInWriting,
  getConfirmingCount,
  getPlacementQuickFormat,
} from "../learner/placement/placement-quick-format";
import {
  fitsExamChoice,
  fitsExamOptions,
  getExamChoiceFormat,
  getExamFormats,
} from "../library/exams/exam-choice-format";
import { type NoticeFormats } from "../library/exams/notice-formats";
import { readBlueprintContent } from "../library/exams/save-exam-blueprint";
import { readGoalExamFormats } from "../library/exams/short-answers";
import { getItemAudienceFilter } from "../library/items/item-field";
import { loadSkillPrerequisites } from "../library/skills/skill-prerequisites";
import { parsePlanGraph, parsePlanSettings } from "../plans/planner/plan-state";

type PlacementItemExam = {
  /** Null until the exam blueprint is linked. */
  blueprintId: string | null;
  name: string;
  /** Null when the notice does not specify an option count. */
  optionCount: number | null;
  /** Quoted past-paper examples; omitted when the picker does not load them. */
  pastQuestions?: string[];
  style: string;
};

export type PlacementItemSkill = {
  description: string;
  exam: PlacementItemExam | null;
  id: string;
  language: string;
  level: CourseLevel | null;
  name: string;
  /** Set for a private course's skill, whose questions are personal content. */
  ownerId: string | null;
  /** The language a language goal's skill practices ("en"); its questions are in it. */
  targetLanguage: string | null;
  /** Avoid these question openings so new cases do not repeat old situations under different names. */
  usedSituations: string[];
};

const MAX_USED_SITUATIONS = 8;
const MAX_SITUATION_LENGTH = 200;

function getItemSituation(content: unknown): string | null {
  const fields = isJsonObject(content) ? content : {};

  const text = [fields.context, fields.question, fields.statement].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );

  return text ? text.replaceAll(/\s+/gu, " ").trim().slice(0, MAX_SITUATION_LENGTH) : null;
}

/** Prioritize already-answered situations so mocks cannot recreate a case the learner saw in placement. */
function getUsedSituations(items: readonly SkillItem[]): string[] {
  const ordered = [
    ...items.filter((item) => isAnswered(item)),
    ...items.filter((item) => !isAnswered(item)),
  ];

  const situations = ordered.flatMap((item) => getItemSituation(item.content) ?? []);
  return [...new Set(situations)].slice(0, MAX_USED_SITUATIONS);
}

function toExamStyle({
  formats,
  scoring,
}: {
  formats: NoticeFormats["formats"];
  scoring: string | undefined;
}): string {
  return [
    ...formats.map((format) =>
      format.options
        ? `${format.kind} (${format.options} options): ${format.description}`
        : `${format.kind}: ${format.description}`,
    ),
    scoring,
  ]
    .filter(Boolean)
    .join(" ");
}

function toOptionCount(formats: NoticeFormats["formats"]): number | null {
  return formats.find((format) => format.kind === "multipleChoice")?.options ?? null;
}

export function toItemExam(blueprint: ExamBlueprint): PlacementItemExam {
  const { structure } = readBlueprintContent(blueprint);
  const formats = getExamFormats(structure);

  return {
    blueprintId: blueprint.id,
    name: blueprint.role ? `${blueprint.name}, ${blueprint.role}` : blueprint.name,
    optionCount: toOptionCount(formats),
    style: toExamStyle({ formats, scoring: structure.mock?.scoring.description }),
  };
}

function toNoticeItemExam({ formats, name }: { formats: NoticeFormats; name: string }) {
  const examFormats = getExamFormats(formats);

  return {
    blueprintId: null,
    name,
    optionCount: toOptionCount(examFormats),
    style: toExamStyle({ formats: examFormats, scoring: undefined }),
  };
}

function getGoalItemExam(
  goal: Pick<Goal, "details" | "kind" | "title"> & { examBlueprint: ExamBlueprint | null },
): { exam: PlacementItemExam | null; formats: NoticeFormats | null } {
  const blueprint = goal.examBlueprint;
  const structure = blueprint ? readBlueprintContent(blueprint).structure : null;
  const formats = readGoalExamFormats({ goal, structure });

  if (blueprint) {
    return { exam: goal.kind === "exam" ? toItemExam(blueprint) : null, formats };
  }

  return { exam: formats ? toNoticeItemExam({ formats, name: goal.title }) : null, formats };
}

type PickingGoal = Pick<Goal, "details"> & {
  examBlueprint: ExamBlueprint | null;
  plan: { graph: unknown; settings: unknown } | null;
};

async function readPickedSkillIds({
  forPlacement,
  goal,
  listeningSkillIds,
  skillIds,
}: {
  forPlacement: boolean;
  goal: PickingGoal | null;
  listeningSkillIds: ReadonlySet<string>;
  skillIds?: string[];
}): Promise<string[]> {
  if (forPlacement && goal && isPlacementSkipped(goal)) {
    return [];
  }

  if (skillIds) {
    return [...new Set(skillIds)].filter((skillId) => !listeningSkillIds.has(skillId));
  }

  const graph = parsePlanGraph(goal?.plan?.graph);

  return pickPlacementItemSkillIds({
    everySkill: isOwnMaterialTest(goal?.examBlueprint ?? null),
    focusAreas: parsePlanSettings(goal?.plan?.settings).focusAreas,
    graph,
    knownAreas: goal ? getKnownSubjects(goal) : [],
    listeningSkillIds,
    ownLevel: goal ? getOwnLevel({ goal }) : null,
    prerequisites: await loadSkillPrerequisites(graph.skills.map((skill) => skill.skillId)),
  });
}

export type PlacementItemFormat = PlacementQuickFormat | "typed";

export type PlacementItemPick = PlacementItemSkill & { needsTyped: boolean };

export type PlacementItemPicks = {
  /** The quick questions each picked skill gets beyond the first (`getConfirmingCount`). */
  confirmingCount: number;
  quickFormat: PlacementQuickFormat;
  skills: PlacementItemPick[];
};

function isQuickFormat(format: PlacementItemFormat): format is PlacementQuickFormat {
  return format !== "typed";
}

type SkillItem = { attempts: { id: string }[]; content: unknown; format: ItemFormat };

type SkillRow = Omit<PlacementItemSkill, "exam" | "usedSituations"> & { items: SkillItem[] };

function isAnswered(item: SkillItem): boolean {
  return item.attempts.length > 0;
}

/** Questions incompatible with the goal's current format or option count do not satisfy coverage. */
function toPick({
  exam,
  exceptAnswered,
  fits,
  quickFormat,
  quickNeeded,
  row,
  writesTyped,
}: {
  exam: PlacementItemExam | null;
  /** Questions the goal's learner already answered don't cover the skill: they won't be asked. */
  exceptAnswered: boolean;
  fits: (item: SkillItem) => boolean;
  quickFormat: PlacementQuickFormat;
  quickNeeded: number;
  row: SkillRow;
  writesTyped: boolean;
}): PlacementItemPick | null {
  const fitting = row.items.filter((item) => fits(item) && !(exceptAnswered && isAnswered(item)));

  const formats = new Set(fitting.map((item) => item.format));
  const quick = fitting.filter((item) => item.format === quickFormat).length;

  if (quick >= quickNeeded) {
    return null;
  }

  return {
    description: row.description,
    exam,
    id: row.id,
    language: row.language,
    level: row.level,
    name: row.name,
    needsTyped: writesTyped && !formats.has("typed"),
    ownerId: row.ownerId,
    targetLanguage: row.targetLanguage,
    usedSituations: getUsedSituations(row.items),
  };
}

/** Never count another exam's, a field's, or a stimulus set's questions as standalone coverage. */
function getCoveringItemFilter({
  blueprintId,
  exam,
  formats,
}: {
  blueprintId: string | null;
  exam: PlacementItemExam | null;
  formats?: readonly PlacementItemFormat[];
}) {
  return exam && !formats
    ? { examBlueprintId: exam.blueprintId, field: null, setId: null }
    : getItemAudienceFilter({ examBlueprintId: blueprintId });
}

/** Workflow bridge: goalId must come from the authenticated boundary. formats narrows generation; exceptAnswered excludes seen questions from coverage. */
export async function pickPlacementItemSkills({
  exceptAnswered = false,
  forPlacement = false,
  formats,
  goalId,
  quickNeeded = 1,
  skillIds,
}: {
  /** Questions the goal's learner already answered don't count: they won't be asked again. */
  exceptAnswered?: boolean;
  /** Only placement respects an explicit placement skip; tests and practice may still request questions. */
  forPlacement?: boolean;
  formats?: readonly PlacementItemFormat[];
  goalId: string;
  /** Required quick-question count before skipping a covered skill; excludes confirming questions. */
  quickNeeded?: number;
  skillIds?: string[];
}): Promise<PlacementItemPicks> {
  const goal = await prisma.goal.findUnique({
    select: {
      details: true,
      examBlueprint: true,
      kind: true,
      plan: { select: { graph: true, settings: true } },
      targetLanguage: true,
      title: true,
      userId: true,
    },
    where: { id: goalId },
  });

  const listeningSkillIds = goal
    ? getListeningSkillIds({ exam: toListeningExam(goal), graph: parsePlanGraph(goal.plan?.graph) })
    : new Set<string>();

  const picked = await readPickedSkillIds({ forPlacement, goal, listeningSkillIds, skillIds });

  const blueprint = goal?.examBlueprint ?? null;
  const { exam, formats: structure } = goal ? getGoalItemExam(goal) : { exam: null, formats: null };
  const choice = exam ? getExamChoiceFormat(structure) : null;

  const fits = (item: SkillItem) =>
    formats ? fitsExamOptions({ choice, item }) : fitsExamChoice({ choice, item });

  const quickFormat =
    formats?.find((format) => isQuickFormat(format)) ?? getPlacementQuickFormat(structure);

  const writesTyped = formats?.includes("typed") ?? (goal !== null && confirmsInWriting(goal));
  const confirmingCount = getConfirmingCount({ forPlacement, formats, quickFormat, writesTyped });
  const needed: ItemFormat[] = [quickFormat, "typed"];

  const skills = await prisma.skill.findMany({
    select: {
      description: true,
      id: true,
      items: {
        orderBy: { createdAt: "desc" },
        select: {
          attempts: {
            select: { id: true },
            take: 1,
            where: { userId: { in: goal ? [goal.userId] : [] } },
          },
          content: true,
          format: true,
        },
        where: {
          format: { in: needed },
          ...getCoveringItemFilter({ blueprintId: blueprint?.id ?? null, exam, formats }),
        },
      },
      language: true,
      level: true,
      name: true,
      ownerId: true,
      targetLanguage: true,
    },
    where: { id: { in: picked } },
  });

  const rules = { exam, exceptAnswered, fits, quickFormat, writesTyped };

  const picks = picked
    .map((id) => skills.find((row) => row.id === id))
    .map((row) =>
      row ? toPick({ ...rules, quickNeeded: quickNeeded + confirmingCount, row }) : null,
    )
    .filter((pick) => pick !== null);

  return { confirmingCount, quickFormat, skills: picks };
}

/** Ends waiting even for failed question writes; uncovered topics are left to lessons and reviews. */
export async function recordPlacementPrepared(goalId: string): Promise<void> {
  await prisma.plan.updateMany({ data: { placementPreparedAt: new Date() }, where: { goalId } });
}
