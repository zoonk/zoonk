import { type CourseLevel, type PlanItem, type Skill } from "@zoonk/db";
import { CEFR_LEVELS, type CefrLevel, formatCefrScore } from "@zoonk/utils/cefr";
import { isHalfStudied, measureStudied } from "../../plans/_utils/half-studied";
import { countLessons } from "../../plans/_utils/stand-in-lessons";
import { getWorkProgress, isWorkFinished } from "../../plans/_utils/work-progress";
import { type PlanGraphSkill } from "../../plans/planner/plan-state";

const LEVELS_PER_BAND = 2;
const HALF_STEP = 0.5;

const BAND_LOWER_LEVEL: Record<CourseLevel, CefrLevel> = {
  advanced: "C1",
  beginner: "A1",
  intermediate: "B1",
  overview: "A1",
};

export type LevelSkill = Pick<Skill, "cefrLevel" | "level">;

export type LevelItem = Pick<
  PlanItem,
  "chapterId" | "completedAt" | "kind" | "lessonId" | "lessons" | "minutes" | "skillId" | "status"
>;

type GraphSkill = Pick<PlanGraphSkill, "lessons" | "plannedLessons" | "skillId">;

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

/** An untagged skill counts at its band's lower level, so the level never reads above the truth. */
function placeSkill(skill: LevelSkill | undefined): Placement | null {
  if (skill?.cefrLevel) {
    return { level: skill.cefrLevel, tagged: true };
  }

  return skill?.level ? { level: BAND_LOWER_LEVEL[skill.level], tagged: false } : null;
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

/**
 * Where one language goal's plan stands at each CEFR level, judged on its own: lesson items count at
 * their skill's level and every other item kind is left out. A level is earned with nothing left to
 * do at it or below, nothing set aside at it, its band tagged, and half its graph size studied.
 */
export function listPlanLevels({
  graphSkills,
  heldBackLessonIds = new Set(),
  items,
  skills,
}: {
  graphSkills: readonly GraphSkill[];
  heldBackLessonIds?: ReadonlySet<string>;
  items: readonly LevelItem[];
  skills: ReadonlyMap<string, LevelSkill>;
}): PlanLevel[] {
  const place = (skillId: string | null) => placeSkill(skills.get(skillId ?? ""));
  const lessons = items.filter((item) => item.kind === "lesson");

  const untaggedBands = new Set(
    [
      ...lessons.map((item) => place(item.skillId)),
      ...graphSkills.map((skill) => place(skill.skillId)),
    ].flatMap((placement) => (placement && !placement.tagged ? getBand(placement.level) : [])),
  );

  const atLevel = CEFR_LEVELS.map((level) => ({
    graph: graphSkills.filter((skill) => place(skill.skillId)?.level === level),
    items: lessons.filter((item) => place(item.skillId)?.level === level),
    level,
  }));

  return atLevel.map(({ graph, items: levelItems, level }, index) => {
    const measure = measureStudied({ graphSkills: graph, items: levelItems });

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
export function getPlanLevelLabel(levels: readonly PlanLevel[]): string | null {
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
export function getUnitLevels(levels: readonly PlanLevel[]): Map<string, CefrLevel> {
  return new Map(
    levels.flatMap((entry) =>
      entry.items.flatMap((item) =>
        item.chapterId ? [[item.chapterId, entry.level] as const] : [],
      ),
    ),
  );
}
