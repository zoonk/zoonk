import "server-only";
import { type Mistake, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { io } from "next/cache";
import { isDrillQuestion } from "../exams/listening/listening-skills";
import {
  GRADABLE_ITEM_FORMATS,
  type QuestionView,
  hasMisconceptions,
  parseChoiceItem,
  toQuestionView,
} from "../learner/_utils/choice-items";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { type TrueFalseLabels, getTrueFalseLabels } from "../library/exams/true-false-labels";
import { IN_BANK, getGoalField, getItemAudienceFilter } from "../library/items/item-field";
import { ITEM_IMAGE_INCLUDE } from "../library/items/item-image";
import { type ItemSetView } from "../library/items/item-set-view";
import { ITEM_SET_INCLUDE, toItemSetView } from "../library/items/item-sets";
import { loadExamStructure } from "../sessions/_utils/exam-structure";
import { getSession } from "../users/get-session";
import { resolvePracticeScope } from "./_utils/practice-scope";
import { MAX_PRACTICE_ANSWERS, type MistakePracticeInput } from "./contract";
import { findTeachingLessonIds, loadDrillLessons, toDrillView } from "./drill-lessons";
import { getMistakePracticeBefore } from "./mistake-availability";
import {
  type DrillView,
  isFixedByItsSkill,
  isMistakeSkill,
  selectMistakesToPractice,
  selectPracticeRun,
} from "./mistake-drills";
import { filterMistakesWithPracticeMaterial } from "./mistake-practice-eligibility";
import { type MistakeSnapshot, readMistakeSnapshot } from "./mistake-snapshot";

type MistakePracticeEntry = {
  cause: Mistake["cause"];
  drill: DrillView;
  mistakeId: string;
  /** Stimulus sets must be displayed with their questions. */
  questions: (QuestionView & { set: ItemSetView | null })[];
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

function getPracticeSkillIds({
  scopeSkillIds,
  skillId,
}: {
  scopeSkillIds: string[] | null;
  skillId: string | undefined;
}): string[] | null {
  if (!skillId) {
    return scopeSkillIds;
  }

  return !scopeSkillIds || scopeSkillIds.includes(skillId) ? [skillId] : [];
}

async function loadDrillMaterial({
  examBlueprintId,
  field,
  mistakes,
  ownerOf,
  userId,
}: {
  /** Other exams are excluded except for the mistake's original question. */
  examBlueprintId: string | null;
  /** Other fields are excluded except for the mistake's original question. */
  field: string | null;
  mistakes: readonly Mistake[];
  /** The goal skill each finer skill counts for, whose questions drill it too. */
  ownerOf: ReadonlyMap<string, string>;
  userId: string;
}) {
  const skillIds = [
    ...new Set(mistakes.map((mistake) => mistake.skillId).filter((id) => id !== null)),
  ];

  const questionSkillIds = [...new Set(skillIds.flatMap((id) => [id, ownerOf.get(id) ?? id]))];

  const where = {
    ...IN_BANK,
    format: { in: [...GRADABLE_ITEM_FORMATS] },
    skillId: { in: questionSkillIds },
  };

  const [bank, lessons] = await Promise.all([
    prisma.item.findMany({
      include: ITEM_IMAGE_INCLUDE,
      orderBy: { id: "asc" },
      where: { ...where, ...getItemAudienceFilter({ examBlueprintId, field }) },
    }),
    findTeachingLessonIds({ skillIds, userId }),
  ]);

  const bankIds = new Set(bank.map((item) => item.id));

  const outsideBankIds = mistakes.flatMap((mistake) =>
    mistake.itemId && !bankIds.has(mistake.itemId) ? [mistake.itemId] : [],
  );

  const [originals, answered] = await Promise.all([
    outsideBankIds.length > 0
      ? prisma.item.findMany({
          include: { ...ITEM_IMAGE_INCLUDE, ...ITEM_SET_INCLUDE },
          where: { ...where, id: { in: outsideBankIds } },
        })
      : [],
    prisma.attempt.groupBy({ by: ["itemId"], where: { itemId: { in: [...bankIds] }, userId } }),
  ]);

  const seen = new Set(answered.map((attempt) => attempt.itemId));

  const choices = [...bank, ...originals]
    .map((item) => parseChoiceItem(item))
    .filter((item) => item !== null);

  // The audience filter leaves set questions out of the bank, so only an original has a set.
  const sets = new Map(originals.map((item) => [item.id, toItemSetView({ item })]));

  return { bankIds, choices, lessons, seen, sets };
}

/** Every ready mistake a run holds, oldest first with skill breadth, one question each; excludes today. Submit each answer to answerMistakePractice. */
export async function getMistakePractice(
  input: MistakePracticeInput,
): Promise<MistakePracticeResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const scope = await resolvePracticeScope({ goalId: input.goalId, userId });

  if (!scope) {
    return { status: "notFound" };
  }

  const timeZone = getAnswerTimeZone({ goal: scope.goal, timeZone: input.timeZone });

  // Next's io boundary keeps the live practice day out of prerendering.
  await io();
  const today = getDateInTimeZone({ date: new Date(), timeZone });

  const skillIds = getPracticeSkillIds({ scopeSkillIds: scope.skillIds, skillId: input.skillId });

  const open = await prisma.mistake.findMany({
    orderBy: { createdAt: "asc" },
    where: {
      createdAt: { lt: getMistakePracticeBefore({ localDate: today, timeZone }) },
      status: "open",
      userId,
      ...(skillIds ? { skillId: { in: skillIds } } : {}),
    },
  });

  const { listeningSkillIds } = scope;

  const drillable = await filterMistakesWithPracticeMaterial({
    examBlueprintId: scope.goal?.examBlueprintId ?? null,
    field: getGoalField(scope.goal?.details),
    listeningSkillIds,
    mistakes: open,
    ownerOf: scope.ownerOf,
  });

  const selected = selectMistakesToPractice({
    limit: MAX_PRACTICE_ANSWERS,
    mistakes: drillable.map((mistake) => ({
      ...mistake,
      createdLocalDate: getDateInTimeZone({ date: mistake.createdAt, timeZone }),
    })),
    today,
  });

  const { bankIds, choices, lessons, seen, sets } = await loadDrillMaterial({
    examBlueprintId: scope.goal?.examBlueprintId ?? null,
    field: getGoalField(scope.goal?.details),
    mistakes: selected,
    ownerOf: scope.ownerOf,
    userId,
  });

  const run = selectPracticeRun(
    selected.map((mistake) => {
      const skillItems = choices.filter(
        (item) =>
          (bankIds.has(item.id) || item.id === mistake.itemId) &&
          isMistakeSkill({
            itemSkillId: item.skillId,
            mistakeSkillId: mistake.skillId,
            ownerOf: scope.ownerOf,
          }) &&
          isDrillQuestion({ item, listeningSkillIds, mistakeItemId: mistake.itemId }),
      );

      return {
        candidates: skillItems.map((item) => ({
          hasMisconceptions: hasMisconceptions(item),
          id: item.id,
          seen: seen.has(item.id),
          skillId: item.skillId,
        })),
        cause: mistake.cause,
        coveringSkillIds:
          mistake.skillId &&
          !listeningSkillIds.has(mistake.skillId) &&
          isFixedByItsSkill(mistake.cause)
            ? [mistake.skillId, scope.ownerOf.get(mistake.skillId) ?? mistake.skillId]
            : [],
        lessonId: mistake.skillId ? (lessons.get(mistake.skillId) ?? null) : null,
        mistake,
        originalItemId: mistake.itemId,
        skillItems,
      };
    }),
  );

  const [drillLessons, structure] = await Promise.all([
    loadDrillLessons(run.map(({ drill }) => drill.lessonId)),
    scope.goal ? loadExamStructure(scope.goal) : null,
  ]);

  const practice = run.map(({ drill, mistake, skillItems }) => ({
    cause: mistake.cause,
    drill: toDrillView({ drill, lessons: drillLessons }),
    mistakeId: mistake.id,
    questions: drill.itemIds
      .map((id) => skillItems.find((item) => item.id === id))
      .filter((item) => item !== undefined)
      .map((item) => ({ ...toQuestionView(item), set: sets.get(item.id) ?? null })),
    snapshot: readMistakeSnapshot(mistake.snapshot),
  }));

  return { practice, status: "ready", trueFalseLabels: getTrueFalseLabels(structure) };
}
