import "server-only";
import { type Mistake, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { io } from "next/cache";
import {
  GRADABLE_ITEM_FORMATS,
  type QuestionView,
  hasMisconceptions,
  parseChoiceItem,
  toQuestionView,
} from "../learner/_utils/choice-items";
import { loadGoalSkillIds } from "../learner/_utils/goal-skill-graph";
import { findOwnedGoal, getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { type TrueFalseLabels, getTrueFalseLabels } from "../library/exams/true-false-labels";
import { getGoalField, getItemAudienceFilter } from "../library/items/item-field";
import { ITEM_IMAGE_INCLUDE } from "../library/items/item-image";
import { loadExamStructure } from "../sessions/_utils/load-build-inputs";
import { getSession } from "../users/get-session";
import { type MistakePracticeInput } from "./contract";
import {
  type DrillView,
  findTeachingLessonIds,
  loadDrillLessons,
  toDrillView,
} from "./drill-lessons";
import { selectMistakeDrill, selectMistakesToPractice } from "./mistake-drills";
import { type MistakeSnapshot, readMistakeSnapshot } from "./mistake-snapshot";

/** One tap of "Practice mistakes" is a short session: five mistakes, each with its drill. */
const PRACTICE_SIZE = 5;

/** Open mistakes considered for one practice session, oldest first. */
const PRACTICE_POOL = 100;

type MistakePracticeEntry = {
  cause: Mistake["cause"];
  drill: DrillView;
  mistakeId: string;
  questions: QuestionView[];
  snapshot: MistakeSnapshot;
};

export type MistakePracticeResult =
  | {
      practice: MistakePracticeEntry[];
      status: "ready";
      /** The words true-or-false statements are answered with: the goal's exam's, when scoped. */
      trueFalseLabels: TrueFalseLabels;
    }
  | { status: "notFound" }
  | { status: "unauthorized" };

async function resolveScope(goalId: string | undefined) {
  if (!goalId) {
    return { goal: null, skillIds: null };
  }

  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return null;
  }

  return { goal: owned.goal, skillIds: await loadGoalSkillIds(goalId) };
}

async function loadDrillMaterial({
  examBlueprintId,
  field,
  mistakes,
  userId,
}: {
  /** The goal's exam: other exams' questions stay out, apart from the mistakes' own. */
  examBlueprintId: string | null;
  /** The goal's field: other fields' questions stay out, apart from the mistakes' own. */
  field: string | null;
  mistakes: readonly Mistake[];
  userId: string;
}) {
  const skillIds = [
    ...new Set(mistakes.map((mistake) => mistake.skillId).filter((id) => id !== null)),
  ];

  const [items, lessons] = await Promise.all([
    prisma.item.findMany({
      include: ITEM_IMAGE_INCLUDE,
      orderBy: { id: "asc" },
      where: {
        format: { in: [...GRADABLE_ITEM_FORMATS] },
        skillId: { in: skillIds },
        ...getItemAudienceFilter({
          examBlueprintId,
          field,
          keepIds: mistakes.flatMap((mistake) => mistake.itemId ?? []),
        }),
      },
    }),
    findTeachingLessonIds({ skillIds, userId }),
  ]);

  const answered = await prisma.attempt.findMany({
    distinct: ["itemId"],
    select: { itemId: true },
    where: { itemId: { in: items.map((item) => item.id) }, userId },
  });

  const seen = new Set(answered.map((attempt) => attempt.itemId));
  const choices = items.map((item) => parseChoiceItem(item)).filter((item) => item !== null);

  return { choices, lessons, seen };
}

/**
 * Builds "Practice mistakes": up to five open mistakes (oldest first, one per skill first, none from
 * today), each with a drill chosen by its cause and the questions to answer, the original one
 * first. Answers go to `answerMistakePractice`.
 */
export async function getMistakePractice(
  input: MistakePracticeInput,
): Promise<MistakePracticeResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const scope = await resolveScope(input.goalId);

  if (!scope) {
    return { status: "notFound" };
  }

  const timeZone = getAnswerTimeZone({ goal: scope.goal, timeZone: input.timeZone });

  // Which mistakes are from today depends on when the learner opens practice: read at request
  // time, never in a prerender.
  await io();
  const today = getDateInTimeZone({ date: new Date(), timeZone });

  const open = await prisma.mistake.findMany({
    orderBy: { createdAt: "asc" },
    take: PRACTICE_POOL,
    where: {
      status: "open",
      userId,
      ...(scope.skillIds ? { skillId: { in: scope.skillIds } } : {}),
    },
  });

  const selected = selectMistakesToPractice({
    limit: PRACTICE_SIZE,
    mistakes: open.map((mistake) => ({
      ...mistake,
      createdLocalDate: getDateInTimeZone({ date: mistake.createdAt, timeZone }),
    })),
    today,
  });

  const { choices, lessons, seen } = await loadDrillMaterial({
    examBlueprintId: scope.goal?.examBlueprintId ?? null,
    field: getGoalField(scope.goal?.details),
    mistakes: selected,
    userId,
  });

  const drills = selected.map((mistake) => {
    const skillItems = choices.filter((item) => item.skillId === mistake.skillId);

    const drill = selectMistakeDrill({
      candidates: skillItems.map((item) => ({
        hasMisconceptions: hasMisconceptions(item),
        id: item.id,
        seen: seen.has(item.id),
      })),
      cause: mistake.cause,
      lessonId: mistake.skillId ? (lessons.get(mistake.skillId) ?? null) : null,
      originalItemId: mistake.itemId,
    });

    return { drill, mistake, skillItems };
  });

  const [drillLessons, structure] = await Promise.all([
    loadDrillLessons(drills.map(({ drill }) => drill.lessonId)),
    scope.goal ? loadExamStructure(scope.goal) : null,
  ]);

  const practice = drills.map(({ drill, mistake, skillItems }) => ({
    cause: mistake.cause,
    drill: toDrillView({ drill, lessons: drillLessons }),
    mistakeId: mistake.id,
    questions: drill.itemIds
      .map((id) => skillItems.find((item) => item.id === id))
      .filter((item) => item !== undefined)
      .map((item) => toQuestionView(item)),
    snapshot: readMistakeSnapshot(mistake.snapshot),
  }));

  return { practice, status: "ready", trueFalseLabels: getTrueFalseLabels(structure) };
}
