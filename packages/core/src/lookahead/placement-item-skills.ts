import "server-only";
import {
  type CourseLevel,
  type ExamBlueprint,
  type Goal,
  type ItemFormat,
  prisma,
} from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getKnownSubjects } from "../learner/placement/placement-contract";
import { pickPlacementItemSkillIds } from "../learner/placement/placement-item-picks";
import { isOwnMaterialTest } from "../learner/placement/placement-material";
import {
  type PlacementQuickFormat,
  getPlacementQuickFormat,
} from "../learner/placement/placement-quick-format";
import {
  fitsExamChoice,
  fitsExamOptions,
  getExamChoiceFormat,
  getExamFormats,
} from "../library/exams/exam-choice-format";
import { type NoticeFormats, readNoticeFormats } from "../library/exams/notice-formats";
import { readBlueprintContent } from "../library/exams/save-exam-blueprint";
import { getItemAudienceFilter } from "../library/items/item-field";
import { parsePlanGraph } from "../plans/planner/plan-state";

/** An exam goal's questions look like the exam's own: its name, format and option count. */
type PlacementItemExam = {
  /** Null while the goal knows only its notice's formats, before the blueprint is linked. */
  blueprintId: string | null;
  name: string;
  /** Options per multiple-choice question, such as 5 for ENEM; null when the notice doesn't say. */
  optionCount: number | null;
  /** How the exam's questions look and score, in the notice's words. */
  style: string;
};

export type PlacementItemSkill = {
  description: string;
  /** The goal's exam, so its questions probe the skill the way the exam asks it. */
  exam: PlacementItemExam | null;
  id: string;
  language: string;
  level: CourseLevel | null;
  name: string;
  /** Set for a private course's skill, whose questions are personal content. */
  ownerId: string | null;
  /** The language a language goal's skill practices ("en"); its questions are in it. */
  targetLanguage: string | null;
  /**
   * How the skill's questions in the bank open (their context or question), so new ones put the
   * skill in other situations: a learner who met a case in placement doesn't meet it again in a
   * mock under other names.
   */
  usedSituations: string[];
};

/** The situations passed to a writer: enough to steer it away from them, few enough to read. */
const MAX_USED_SITUATIONS = 8;
const MAX_SITUATION_LENGTH = 200;

/** How a question opens: its context, else its question or statement, on one line. */
function getItemSituation(content: unknown): string | null {
  const fields = isJsonObject(content) ? content : {};

  const text = [fields.context, fields.question, fields.statement].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );

  return text ? text.replaceAll(/\s+/gu, " ").trim().slice(0, MAX_SITUATION_LENGTH) : null;
}

function getUsedSituations(items: readonly { content: unknown }[]): string[] {
  const situations = items.flatMap((item) => getItemSituation(item.content) ?? []);
  return [...new Set(situations)].slice(0, MAX_USED_SITUATIONS);
}

/** How the exam's questions look and score, in the notice's words, for an item writer. */
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

/** How the goal's exam asks its questions, for an item writer to follow. */
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

/**
 * The goal's exam as a first pass over its new notice read it (`readNoticeFormats`): its formats
 * only, under the goal's own name for it, until the notice's blueprint is linked.
 */
function toNoticeItemExam({ name, notice }: { name: string; notice: NoticeFormats }) {
  const formats = getExamFormats(notice);

  return {
    blueprintId: null,
    name,
    optionCount: toOptionCount(formats),
    style: toExamStyle({ formats, scoring: undefined }),
  };
}

/**
 * The exam a goal's placement questions follow, and how its questions look: the linked notice's
 * blueprint, or the formats a first pass over a notice still being read found; neither for a goal
 * that isn't an exam or knows nothing of its exam's questions yet.
 */
function getGoalItemExam(
  goal: Pick<Goal, "details" | "kind" | "title"> & { examBlueprint: ExamBlueprint | null },
): { exam: PlacementItemExam | null; formats: NoticeFormats | null } {
  const blueprint = goal.examBlueprint;

  if (blueprint) {
    const { structure } = readBlueprintContent(blueprint);
    return { exam: goal.kind === "exam" ? toItemExam(blueprint) : null, formats: structure };
  }

  const notice = goal.kind === "exam" ? readNoticeFormats(goal.details) : null;

  return { exam: notice ? toNoticeItemExam({ name: goal.title, notice }) : null, formats: notice };
}

/** The picks from the goal's plan, or the ones the run picked from its skill graph. */
function readPickedSkillIds({
  everySkill,
  knownAreas,
  planGraph,
  skillIds,
}: {
  everySkill: boolean;
  knownAreas: readonly string[];
  planGraph: unknown;
  skillIds?: string[];
}): string[] {
  return [
    ...new Set(
      skillIds ??
        pickPlacementItemSkillIds({ everySkill, graph: parsePlanGraph(planGraph), knownAreas }),
    ),
  ];
}

/** The formats a run writes for placement: a quick one to ask a skill, and a typed confirmation. */
export type PlacementItemFormat = PlacementQuickFormat | "typed";

/** A picked skill, and whether it still needs the typed question that confirms a right answer. */
export type PlacementItemPick = PlacementItemSkill & { needsTyped: boolean };

export type PlacementItemPicks = {
  /** How the goal's placement asks quickly: its questions are written in this format. */
  quickFormat: PlacementQuickFormat;
  skills: PlacementItemPick[];
};

function isQuickFormat(format: PlacementItemFormat): format is PlacementQuickFormat {
  return format !== "typed";
}

type SkillRow = Omit<PlacementItemSkill, "exam" | "usedSituations"> & {
  items: { content: unknown; format: ItemFormat }[];
};

/**
 * A picked skill that still needs placement's questions, or null when this goal's placement can
 * already ask it in the goal's quick format. A question that won't be asked counts as missing
 * (`fits`): an exam goal's in another choice format or with another number of options, such as an
 * old four-option question for ENEM's five. The typed confirmation comes along when it's missing.
 */
function toPick({
  exam,
  fits,
  quickFormat,
  quickNeeded,
  row,
  writesTyped,
}: {
  exam: PlacementItemExam | null;
  fits: (item: SkillRow["items"][number]) => boolean;
  quickFormat: PlacementQuickFormat;
  quickNeeded: number;
  row: SkillRow;
  writesTyped: boolean;
}): PlacementItemPick | null {
  const fitting = row.items.filter((item) => fits(item));
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

/**
 * The questions that cover a skill for this run. Placement for an exam goal asks its exam's own
 * questions (see `preferExamItems`), so only those count: a skill with only general ones gets the
 * exam's written once, shared by every later learner of that exam. Other goals, and a run that
 * narrows `formats` (a test-out's multiple choice, which asks general questions too), count
 * general ones and the exam's; never another exam's or a field's.
 */
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
    ? { examBlueprintId: exam.blueprintId, field: null }
    : getItemAudienceFilter({ examBlueprintId: blueprintId });
}

/**
 * The goal's skills placement is most likely to ask about that have no question it can ask yet: a
 * few in every area of every phase (`pickPlacementItemSkillIds`), so placement can start while the
 * rest of the curriculum is being written. A run that picked them from the skill graph passes them
 * (`skillIds`), while the plan is saved. Questions are shared, so a skill is skipped when it has
 * `quickNeeded` in the goal's quick format (`getPlacementQuickFormat`) that cover it
 * (`getCoveringItemFilter`).
 * So a Cebraspe goal whose notice was read after its first questions were written gets true/false
 * ones for its exam on the next call. An exam goal's questions follow the exam's style; `formats`
 * narrows what's written, such as a test-out's multiple choice only, and a focus test, which
 * never asks a question again, counts only the ones the goal's learner hasn't answered
 * (`exceptAnswered`).
 *
 * This is a workflow bridge: the goal id comes from the goal the public boundary created.
 */
export async function pickPlacementItemSkills({
  exceptAnswered = false,
  formats,
  goalId,
  quickNeeded = 1,
  skillIds,
}: {
  /** Questions the goal's learner already answered don't count: they won't be asked again. */
  exceptAnswered?: boolean;
  formats?: readonly PlacementItemFormat[];
  goalId: string;
  /**
   * How many quick questions a skill needs before it's skipped: one for placement, more for a
   * chapter's test-out, which asks a chapter of few skills each of them several times.
   */
  quickNeeded?: number;
  skillIds?: string[];
}): Promise<PlacementItemPicks> {
  const goal = await prisma.goal.findUnique({
    select: {
      details: true,
      examBlueprint: true,
      kind: true,
      plan: { select: { graph: true } },
      title: true,
      userId: true,
    },
    where: { id: goalId },
  });

  const picked = readPickedSkillIds({
    everySkill: isOwnMaterialTest(goal?.examBlueprint ?? null),
    knownAreas: goal ? getKnownSubjects(goal) : [],
    planGraph: goal?.plan?.graph,
    skillIds,
  });

  const blueprint = goal?.examBlueprint ?? null;
  const { exam, formats: structure } = goal ? getGoalItemExam(goal) : { exam: null, formats: null };
  const choice = exam ? getExamChoiceFormat(structure) : null;

  // Placement asks only questions in its exam's choice format (`loadPlacementItems`); a caller
  // that narrows the formats, such as a test-out, asks the rest too, but never a question with
  // another number of options than the exam's.
  const fits = (item: SkillRow["items"][number]) =>
    formats ? fitsExamOptions({ choice, item }) : fitsExamChoice({ choice, item });

  const quickFormat =
    formats?.find((format) => isQuickFormat(format)) ?? getPlacementQuickFormat(structure);

  const writesTyped = formats?.includes("typed") ?? true;
  const needed: ItemFormat[] = [quickFormat, "typed"];

  const skills = await prisma.skill.findMany({
    select: {
      description: true,
      id: true,
      items: {
        select: { content: true, format: true },
        where: {
          format: { in: needed },
          ...getCoveringItemFilter({ blueprintId: blueprint?.id ?? null, exam, formats }),
          ...(exceptAnswered && goal ? { attempts: { none: { userId: goal.userId } } } : {}),
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

  const picks = picked
    .map((id) => skills.find((row) => row.id === id))
    .map((row) => (row ? toPick({ exam, fits, quickFormat, quickNeeded, row, writesTyped }) : null))
    .filter((pick) => pick !== null);

  return { quickFormat, skills: picks };
}

/**
 * Placement's questions for the goal's plan are written (the ones that failed won't come), so
 * placement stops waiting for missing ones: those skills are left to lessons and reviews, and a
 * goal with none at all goes on without placement.
 */
export async function recordPlacementPrepared(goalId: string): Promise<void> {
  await prisma.plan.updateMany({ data: { placementPreparedAt: new Date() }, where: { goalId } });
}
