import { type PlanItem, type Skill } from "@zoonk/db";
import { CEFR_LEVELS, type CefrLevel, formatCefrScore } from "@zoonk/utils/cefr";
import { type PlanScope, isHalfStudied, measureStudied } from "../../plans/_utils/half-studied";
import { countLessons } from "../../plans/_utils/stand-in-lessons";
import { getWorkProgress, isWorkFinished } from "../../plans/_utils/work-progress";
import { BAND_LEVELS } from "./skill-level-rules";

const LEVELS_PER_BAND = 2;
const HALF_STEP = 0.5;

export type LevelSkill = Pick<Skill, "cefrLevel" | "level">;

export type LevelItem = Pick<
  PlanItem,
  "chapterId" | "completedAt" | "kind" | "lessonId" | "lessons" | "minutes" | "skillId" | "status"
>;

export type PlanLevel = {
  /** Finished, every lesson in its band tagged, and at least half of its full size studied. */
  earned: boolean;
  /** Its lesson items, in plan order. */
  items: LevelItem[];
  level: CefrLevel;
  size: number;
  studied: number;
};

type Placement = { level: CefrLevel; tagged: boolean };

type LevelSkills = ReadonlyMap<string, LevelSkill>;

/** An untagged skill counts at its band's lower level, so the level never reads above the truth. */
function placeSkill(skill: LevelSkill | undefined): Placement | null {
  if (skill?.cefrLevel) {
    return { level: skill.cefrLevel, tagged: true };
  }

  return skill?.level ? { level: BAND_LEVELS[skill.level][0], tagged: false } : null;
}

function getRank(placement: Placement): number {
  return CEFR_LEVELS.indexOf(placement.level);
}

/**
 * A lesson counts once, at the lowest level of the plan skills it teaches. It stays untagged while
 * an untagged skill's band could put it lower.
 */
function placeLesson({
  skillIds,
  skills,
}: {
  skillIds: readonly string[];
  skills: LevelSkills;
}): Placement | null {
  const placements = skillIds.flatMap((skillId) => placeSkill(skills.get(skillId)) ?? []);

  const [lowest] = placements.toSorted(
    (a, b) => getRank(a) - getRank(b) || Number(b.tagged) - Number(a.tagged),
  );

  return lowest ?? null;
}

/**
 * Where each item counts: at its lesson's level when the plan counts its lesson, otherwise at its
 * skill's. The size, the studied count, a level's blockers and its label all read this one map.
 */
function placeItems({ scope, skills }: { scope: Pick<PlanScope, "lessons">; skills: LevelSkills }) {
  const lessons = new Map(
    scope.lessons.map((lesson) => [
      lesson.lessonId,
      placeLesson({ skillIds: lesson.skillIds, skills }),
    ]),
  );

  const place = (item: Pick<LevelItem, "lessonId" | "skillId">): Placement | null =>
    item.lessonId && lessons.has(item.lessonId)
      ? (lessons.get(item.lessonId) ?? null)
      : placeSkill(skills.get(item.skillId ?? ""));

  return { lessons, place };
}

function getBand(level: CefrLevel): number {
  return Math.floor(CEFR_LEVELS.indexOf(level) / LEVELS_PER_BAND);
}

function isTodo(item: LevelItem): boolean {
  return getWorkProgress(item.status) === "todo";
}

/** Set aside by the plan or the learner; a lesson nothing will ever write again doesn't hold its level back. */
function isLeftOut({
  heldBackLessonIds,
  item,
}: {
  heldBackLessonIds: ReadonlySet<string>;
  item: LevelItem;
}): boolean {
  return (
    getWorkProgress(item.status) === "setAside" &&
    !(item.lessonId && heldBackLessonIds.has(item.lessonId))
  );
}

type LevelItems = Pick<PlanLevel, "items" | "level">;

function groupByLevel({
  items,
  place,
}: {
  items: readonly LevelItem[];
  place: (item: LevelItem) => Placement | null;
}): LevelItems[] {
  const lessons = items.filter((item) => item.kind === "lesson");

  return CEFR_LEVELS.map((level) => ({
    items: lessons.filter((item) => place(item)?.level === level),
    level,
  }));
}

/** Each CEFR level's lesson items, in plan order. */
export function groupLevelItems({
  items,
  scope,
  skills,
}: {
  items: readonly LevelItem[];
  scope: Pick<PlanScope, "lessons">;
  skills: LevelSkills;
}): LevelItems[] {
  return groupByLevel({ items, place: placeItems({ scope, skills }).place });
}

/**
 * Where one language goal's plan stands at each CEFR level, judged on its own: lesson items count
 * where `placeItems` puts them and every other item kind is left out. A level is earned with nothing
 * left to do at it or below, nothing set aside at it, its band tagged, and half its lessons studied.
 */
export function listPlanLevels({
  heldBackLessonIds = new Set(),
  items,
  scope,
  skills,
}: {
  heldBackLessonIds?: ReadonlySet<string>;
  items: readonly LevelItem[];
  scope: PlanScope;
  skills: LevelSkills;
}): PlanLevel[] {
  const { lessons, place } = placeItems({ scope, skills });
  const atLevel = groupByLevel({ items, place });

  const untaggedBands = new Set(
    [
      ...items.map((item) => (item.kind === "lesson" ? place(item) : null)),
      ...scope.graphSkillIds.map((skillId) => placeSkill(skills.get(skillId))),
    ].flatMap((placement) => (placement && !placement.tagged ? getBand(placement.level) : [])),
  );

  return atLevel.map(({ items: levelItems, level }, index) => {
    const measure = measureStudied({
      items: levelItems,
      lessonIds: new Set(
        [...lessons].flatMap(([lessonId, placement]) =>
          placement?.level === level ? lessonId : [],
        ),
      ),
      unwritten: scope.unwritten.reduce(
        (sum, skill) =>
          placeSkill(skills.get(skill.skillId))?.level === level ? sum + skill.lessons : sum,
        0,
      ),
    });

    const finished =
      !atLevel.slice(0, index + 1).some((below) => below.items.some((item) => isTodo(item))) &&
      !levelItems.some((item) => isLeftOut({ heldBackLessonIds, item }));

    return {
      earned: finished && !untaggedBands.has(getBand(level)) && isHalfStudied(measure),
      items: levelItems,
      level,
      ...measure,
    };
  });
}

function isPlanned(item: LevelItem): boolean {
  return getWorkProgress(item.status) !== "setAside";
}

function isHalfFinished(items: readonly LevelItem[]): boolean {
  const planned = items.filter((item) => isPlanned(item));
  const finished = countLessons(planned.filter((item) => isWorkFinished(item.status)));

  return finished > 0 && finished * 2 >= countLessons(planned);
}

/**
 * The lowest level with lessons still to do, or the highest the plan holds once none are left, with
 * a "+" once half of that level's lessons in the plan are finished: finishing B1+ earns B1.
 */
export function getPlanLevelLabel(levels: readonly LevelItems[]): string | null {
  const planned = levels.filter((entry) => entry.items.some((item) => isPlanned(item)));

  const current =
    planned.find((entry) => entry.items.some((item) => isTodo(item))) ?? planned.at(-1);

  if (!current) {
    return null;
  }

  const plus = isHalfFinished(current.items) ? HALF_STEP : 0;
  return formatCefrScore(CEFR_LEVELS.indexOf(current.level) + plus);
}

/** A unit's can-do statements go on the highest level among its lessons. */
export function getUnitLevels(levels: readonly LevelItems[]): Map<string, CefrLevel> {
  return new Map(
    levels.flatMap((entry) =>
      entry.items.flatMap((item) =>
        item.chapterId ? [[item.chapterId, entry.level] as const] : [],
      ),
    ),
  );
}
