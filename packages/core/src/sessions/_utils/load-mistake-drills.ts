import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isDrillQuestion, listDrillableMistakes } from "../../exams/listening/listening-skills";
import { type GoalSkillNode, getSkillOwners } from "../../learner/_utils/goal-skill-graph";
import { getFieldRank, getItemAudienceFilter } from "../../library/items/item-field";
import { findTeachingLessonIds } from "../../mistakes/drill-lessons";
import { selectMistakeDrill, selectMistakesToPractice } from "../../mistakes/mistake-drills";
import { type BlockDrill } from "../block-payload";
import { loadLastAnswers } from "./load-review-capsules";
import { QUESTION_ITEM_FORMATS, hasTraps, parseSessionItem } from "./session-items";

/** Open mistakes considered for today's drill, oldest first. */
const MISTAKE_POOL = 50;

/** One mistake a day makes the "fix a mistake" mission; the notebook holds the rest. */
const DAILY_MISTAKE_DRILLS = 1;

/** Whether a question is on the mistake's skill, or on the goal skill it counts for. */
function isMistakeSkill({
  itemSkillId,
  mistakeSkillId,
  ownerOf,
}: {
  itemSkillId: string;
  mistakeSkillId: string | null;
  ownerOf: ReadonlyMap<string, string>;
}): boolean {
  return (
    mistakeSkillId !== null &&
    (itemSkillId === mistakeSkillId || itemSkillId === ownerOf.get(mistakeSkillId))
  );
}

/**
 * Today's "fix a mistake": the oldest open mistake on the goal's skills from an earlier day, with
 * the drill its cause calls for (the same question first, then a few more on its skill), its kind,
 * the lesson a content gap goes over first and a timed drill's time box. A mistake in a lesson
 * whose screens teach a finer skill than the plan's is on the goal too: its drill asks the
 * questions of the goal skill the lesson is held for (`getSkillOwners`), where the bank has them.
 * A skill practiced only with recordings gets back only its missed recording question
 * (`listDrillableMistakes`).
 */
export async function loadMistakeDrills({
  examBlueprintId,
  field,
  listeningSkillIds,
  skills,
  timeZone,
  today,
  userId,
}: {
  /** The goal's exam: other exams' questions never come up in a drill. */
  examBlueprintId: string | null;
  /** The goal's field: its questions come first in a drill, other fields' never. */
  field: string | null;
  /** The goal's skills practiced only with recordings (`getListeningSkillIds`). */
  listeningSkillIds: ReadonlySet<string>;
  skills: readonly Pick<GoalSkillNode, "id" | "memberSkillIds">[];
  timeZone: string;
  /** The learner-local date, as a UTC-midnight label. */
  today: Date;
  userId: string;
}): Promise<BlockDrill[]> {
  const ownerOf = getSkillOwners(skills);

  const open = await prisma.mistake.findMany({
    orderBy: { createdAt: "asc" },
    take: MISTAKE_POOL,
    where: { skillId: { in: [...ownerOf.keys()] }, status: "open", userId },
  });

  const drillable = await listDrillableMistakes({ listeningSkillIds, mistakes: open });

  const selected = selectMistakesToPractice({
    limit: DAILY_MISTAKE_DRILLS,
    mistakes: drillable.map((mistake) => ({
      ...mistake,
      createdLocalDate: getDateInTimeZone({ date: mistake.createdAt, timeZone }),
    })),
    today,
  });

  const selectedSkillIds = selected.flatMap((mistake) =>
    mistake.skillId ? [mistake.skillId] : [],
  );

  const [items, lessons] = await Promise.all([
    prisma.item.findMany({
      orderBy: { id: "asc" },
      where: {
        format: { in: [...QUESTION_ITEM_FORMATS] },
        skillId: {
          in: selectedSkillIds.flatMap((skillId) => [skillId, ownerOf.get(skillId) ?? skillId]),
        },
        ...getItemAudienceFilter({
          examBlueprintId,
          field,
          keepIds: selected.flatMap((mistake) => mistake.itemId ?? []),
        }),
      },
    }),
    findTeachingLessonIds({ skillIds: selectedSkillIds, userId }),
  ]);

  const lastAnswers = await loadLastAnswers({ itemIds: items.map((item) => item.id), userId });

  const questions = items
    .toSorted(
      (a, b) =>
        getFieldRank({ field, itemField: a.field }) - getFieldRank({ field, itemField: b.field }),
    )
    .map((item) => parseSessionItem(item))
    .filter((item) => item !== null);

  return selected
    .map((mistake) => {
      const drill = selectMistakeDrill({
        candidates: questions
          .filter(
            (item) =>
              isMistakeSkill({
                itemSkillId: item.skillId,
                mistakeSkillId: mistake.skillId,
                ownerOf,
              }) && isDrillQuestion({ item, listeningSkillIds, mistakeItemId: mistake.itemId }),
          )
          .map((item) => ({
            hasMisconceptions: hasTraps(item),
            id: item.id,
            seen: lastAnswers.has(item.id),
          })),
        cause: mistake.cause,
        lessonId: mistake.skillId ? (lessons.get(mistake.skillId) ?? null) : null,
        originalItemId: mistake.itemId,
      });

      return { ...drill, mistakeId: mistake.id };
    })
    .filter((drill) => drill.itemIds.length > 0);
}
