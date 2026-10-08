import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import {
  type ChoiceItem,
  type QuestionView,
  parseChoiceItem,
  toQuestionView,
} from "../../../learner/_utils/choice-items";
import {
  type PlacementQuickFormat,
  getPlacementQuickFormat,
} from "../../../learner/placement/placement-quick-format";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { fitsExamOptions, getExamChoiceFormat } from "../../../library/exams/exam-choice-format";
import { type TrueFalseLabels, getTrueFalseLabels } from "../../../library/exams/true-false-labels";
import { getItemAudienceFilter } from "../../../library/items/item-field";
import { ITEM_IMAGE_INCLUDE } from "../../../library/items/item-image";
import { loadExamStructure } from "../../../sessions/_utils/load-build-inputs";
import { parsePlanGraph, parsePlanSettings } from "../../planner/plan-state";
import {
  FOCUS_TEST_MIN_AREAS,
  type FocusTestArea,
  getQuestionsPerArea,
  pickFocusTestAreas,
  spreadAreaQuestions,
} from "../focus-test-rules";
import { getFocusTestAreas } from "./focus-test-areas";

/** A question of the test, with the area it asks about as learners call it, shown above it. */
type FocusTestQuestion = QuestionView & { area: string };

/** What the test asks: its areas, and the format its questions take (the exam's own). */
export type FocusTestShape = {
  areas: FocusTestArea[];
  questionsPerArea: number;
  quickFormat: PlacementQuickFormat;
  structure: ExamStructure | null;
};

export type FocusTest = {
  /** The areas it asks about, in the plan's order. */
  areas: string[];
  /** Skills with no question for their place yet: the learner's Start writes them. */
  needsItems: string[];
  /** The questions that exist, area by area; the ones still written come after them. */
  questions: FocusTestQuestion[];
  questionsPerArea: number;
  trueFalseLabels: TrueFalseLabels;
};

/**
 * The areas the goal's focus test asks about and the format it asks in, or null when the plan
 * has fewer than two areas to choose between.
 */
export async function loadFocusTestShape(
  goal: Pick<Goal, "examBlueprintId" | "id">,
): Promise<FocusTestShape | null> {
  const [plan, structure] = await Promise.all([
    prisma.plan.findUnique({ select: { graph: true, settings: true }, where: { goalId: goal.id } }),
    loadExamStructure(goal),
  ]);

  if (!plan) {
    return null;
  }

  const areas = pickFocusTestAreas(
    getFocusTestAreas({
      graph: parsePlanGraph(plan.graph),
      settings: parsePlanSettings(plan.settings),
      structure,
    }),
  );

  if (areas.length < FOCUS_TEST_MIN_AREAS) {
    return null;
  }

  return {
    areas,
    questionsPerArea: getQuestionsPerArea(areas.length),
    quickFormat: getPlacementQuickFormat(structure),
    structure,
  };
}

/**
 * The questions the test may ask on these skills: in its format with the exam's number of options
 * (`fitsExamOptions`), the goal's exam's and general ones (never another exam's), and never one
 * the learner already answered (placement's, an earlier test's): a test asks what it doesn't know
 * yet. Oldest first, so a question written while the learner answers the ready ones only fills a
 * place that had none, and never takes the place of one already asked.
 */
async function loadCandidates({
  examBlueprintId,
  shape,
  skillIds,
  userId,
}: {
  examBlueprintId: string | null;
  shape: FocusTestShape;
  skillIds: readonly string[];
  userId: string;
}): Promise<ChoiceItem[]> {
  const choice = getExamChoiceFormat(shape.structure);

  const items = await prisma.item.findMany({
    include: ITEM_IMAGE_INCLUDE,
    orderBy: { id: "asc" },
    where: {
      attempts: { none: { userId } },
      format: shape.quickFormat,
      skillId: { in: [...skillIds] },
      ...getItemAudienceFilter({ examBlueprintId }),
    },
  });

  return items
    .filter((item) => fitsExamOptions({ choice, item }))
    .map((item) => parseChoiceItem(item))
    .filter((item) => item !== null);
}

/** An area's questions, one for each of its spread skills, never one twice. */
function pickAreaItems({
  area,
  candidates,
  count,
}: {
  area: FocusTestArea;
  candidates: readonly ChoiceItem[];
  count: number;
}): { item: ChoiceItem | null; skillId: string }[] {
  const skills = spreadAreaQuestions({ count, skillIds: area.skillIds });

  // A skill asked twice takes its next question the second time.
  return skills.map((skillId, index) => {
    const asked = skills.slice(0, index).filter((earlier) => earlier === skillId).length;
    const own = candidates.filter((candidate) => candidate.skillId === skillId);

    return { item: own[asked] ?? null, skillId };
  });
}

/**
 * The goal's focus test for the learner: a few questions on each area worth most (see
 * `pickFocusTestAreas`), spread over each area's skills, in the exam's quick format, and the skills
 * that have no question for their place yet (`needsItems`). The questions that exist are asked
 * while the learner's Start writes the others, which then fill the places that had none. Null when
 * the plan has fewer than two areas. For the capabilities that read it after checking the goal is
 * the learner's.
 */
export async function loadFocusTest({
  goal,
  userId,
}: {
  goal: Pick<Goal, "examBlueprintId" | "id">;
  userId: string;
}): Promise<FocusTest | null> {
  const shape = await loadFocusTestShape(goal);

  if (!shape) {
    return null;
  }

  const candidates = await loadCandidates({
    examBlueprintId: goal.examBlueprintId,
    shape,
    skillIds: shape.areas.flatMap((area) => area.skillIds),
    userId,
  });

  const picks = shape.areas.map((area) => ({
    area,
    items: pickAreaItems({ area, candidates, count: shape.questionsPerArea }),
  }));

  const needsItems = [
    ...new Set(
      picks.flatMap((pick) =>
        pick.items.filter((entry) => !entry.item).map((entry) => entry.skillId),
      ),
    ),
  ];

  const questions = picks.flatMap((pick) =>
    pick.items.flatMap((entry) =>
      entry.item ? [{ ...toQuestionView(entry.item), area: pick.area.label }] : [],
    ),
  );

  return {
    areas: shape.areas.map((area) => area.name),
    needsItems,
    questions,
    questionsPerArea: shape.questionsPerArea,
    trueFalseLabels: getTrueFalseLabels(shape.structure),
  };
}
