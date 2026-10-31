import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isDrillQuestion, listDrillableMistakes } from "../../exams/listening/listening-skills";
import { type GoalSkillNode, getSkillOwners } from "../../learner/_utils/goal-skill-graph";
import { getFieldRank, getItemAudienceFilter } from "../../library/items/item-field";
import { findTeachingLessonIds } from "../../mistakes/drill-lessons";
import {
  isMistakeSkill,
  selectMistakeDrill,
  selectMistakesToPractice,
} from "../../mistakes/mistake-drills";
import { type BlockDrill } from "../block-payload";
import { loadLastAnswers } from "./load-review-capsules";
import { QUESTION_ITEM_FORMATS, hasTraps, parseSessionItem } from "./session-items";

const MISTAKE_POOL = 50;

const DAILY_MISTAKE_DRILLS = 1;

/** Listening-only skills drill only their original missed recording question; finer lesson skills may use their owning goal skill's bank. */
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
