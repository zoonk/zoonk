import "server-only";
import { type CourseLevel, type ExamBlueprint, type ItemFormat, prisma } from "@zoonk/db";
import { pickPlacementItemSkillIds } from "../learner/placement/placement-item-picks";
import {
  type PlacementQuickFormat,
  getPlacementQuickFormat,
} from "../learner/placement/placement-quick-format";
import { readBlueprintContent } from "../library/exams/save-exam-blueprint";
import { getItemAudienceFilter } from "../library/items/item-field";
import { parsePlanGraph } from "../plans/planner/plan-state";

/** An exam goal's questions look like the exam's own: its name, format and option count. */
type PlacementItemExam = {
  blueprintId: string;
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
};

/** How the goal's exam asks its questions, for an item writer to follow. */
export function toItemExam(blueprint: ExamBlueprint): PlacementItemExam {
  const { structure } = readBlueprintContent(blueprint);
  const choice = structure.formats.find((format) => format.kind === "multipleChoice");

  const style = [
    ...structure.formats.map((format) =>
      format.options
        ? `${format.kind} (${format.options} options): ${format.description}`
        : `${format.kind}: ${format.description}`,
    ),
    structure.mock?.scoring.description,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    blueprintId: blueprint.id,
    name: blueprint.role ? `${blueprint.name}, ${blueprint.role}` : blueprint.name,
    optionCount: choice?.options ?? null,
    style,
  };
}

/** The picks from the goal's plan, or the ones the run picked from its skill graph. */
function readPickedSkillIds({
  planGraph,
  skillIds,
}: {
  planGraph: unknown;
  skillIds?: string[];
}): string[] {
  return [...new Set(skillIds ?? pickPlacementItemSkillIds(parsePlanGraph(planGraph)))];
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

type SkillRow = Omit<PlacementItemSkill, "exam"> & { items: { format: ItemFormat }[] };

/**
 * A picked skill that still needs placement's questions, or null when this goal's placement can
 * already ask it in the goal's quick format. The typed confirmation comes along when it's missing.
 */
function toPick({
  exam,
  quickFormat,
  row,
  writesTyped,
}: {
  exam: PlacementItemExam | null;
  quickFormat: PlacementQuickFormat;
  row: SkillRow;
  writesTyped: boolean;
}): PlacementItemPick | null {
  const formats = new Set(row.items.map((item) => item.format));

  if (formats.has(quickFormat)) {
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
  };
}

/**
 * The goal's skills placement is most likely to ask about that have no question it can ask yet: a
 * few in every area of every phase (`pickPlacementItemSkillIds`), so placement can start while the
 * rest of the curriculum is being written. A run that picked them from the skill graph passes them
 * (`skillIds`), while the plan is saved. Questions are shared, so a skill is skipped when it has one
 * this goal's placement would ask in its quick format (`getPlacementQuickFormat`): general or the
 * goal's own exam's, never another exam's or a field's. So a Cebraspe goal whose notice was read
 * after its first questions were written gets true/false ones on the next call, and a
 * multiple-choice exam gets nothing new. An exam goal's questions follow the exam's style;
 * `formats` narrows what's written, such as a test-out's multiple choice only.
 *
 * This is a workflow bridge: the goal id comes from the goal the public boundary created.
 */
export async function pickPlacementItemSkills({
  formats,
  goalId,
  skillIds,
}: {
  formats?: readonly PlacementItemFormat[];
  goalId: string;
  skillIds?: string[];
}): Promise<PlacementItemPicks> {
  const goal = await prisma.goal.findUnique({
    select: { examBlueprint: true, kind: true, plan: { select: { graph: true } } },
    where: { id: goalId },
  });

  const picked = readPickedSkillIds({ planGraph: goal?.plan?.graph, skillIds });
  const blueprint = goal?.examBlueprint ?? null;
  const exam = blueprint && goal?.kind === "exam" ? toItemExam(blueprint) : null;

  const quickFormat =
    formats?.find((format) => isQuickFormat(format)) ??
    getPlacementQuickFormat(blueprint ? readBlueprintContent(blueprint).structure : null);

  const writesTyped = formats?.includes("typed") ?? true;
  const needed: ItemFormat[] = [quickFormat, "typed"];

  const skills = await prisma.skill.findMany({
    select: {
      description: true,
      id: true,
      // The questions this goal's placement could already ask: another exam's never are.
      items: {
        distinct: ["format"],
        select: { format: true },
        where: {
          format: { in: needed },
          ...getItemAudienceFilter({ examBlueprintId: blueprint?.id ?? null }),
        },
      },
      language: true,
      level: true,
      name: true,
      ownerId: true,
    },
    where: { id: { in: picked } },
  });

  const picks = picked
    .map((id) => skills.find((row) => row.id === id))
    .map((row) => (row ? toPick({ exam, quickFormat, row, writesTyped }) : null))
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
