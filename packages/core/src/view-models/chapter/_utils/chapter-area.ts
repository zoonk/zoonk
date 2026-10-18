import { type PlanItem } from "@zoonk/db";
import { countSkillStates } from "../../../learner/mastery-state";
import { isWorkFinished } from "../../../plans/_utils/work-progress";
import { type GoalMap } from "../../_utils/goal-map";
import { type MapArea, type MapSkill } from "../../map/map-contract";

const LEARN_KINDS = new Set<PlanItem["kind"]>(["chapter", "lesson"]);

/** What a chapter's page needs from the goal's map: its number, state and skills. */
export type ChapterArea = Pick<MapArea, "counts" | "skills" | "state"> & { position: number };

function uniqueSkills(skills: readonly MapSkill[]): MapSkill[] {
  return skills.filter(
    (skill, index) => skills.findIndex((other) => other.skillId === skill.skillId) === index,
  );
}

/**
 * A chapter's state from its own lessons: done once they all are, else current when it holds the
 * lesson up next (`GoalMap.upNextItemId`, the one Today opens), else upcoming.
 */
function getItemAreaState({
  chapterId,
  map,
}: {
  chapterId: string;
  map: GoalMap;
}): MapArea["state"] {
  const learnItems = map.items.filter((item) => LEARN_KINDS.has(item.kind));
  const inChapter = learnItems.filter((item) => item.chapterId === chapterId);

  if (inChapter.every((item) => isWorkFinished(item.status))) {
    return "done";
  }

  const upNext = learnItems.find((item) => item.id === map.upNextItemId);
  return upNext?.chapterId === chapterId ? "current" : "upcoming";
}

/**
 * A chapter's state from its own lessons, not its area's: the map files a skill under the chapter
 * that teaches it first, so a chapter whose skill goes on in a later chapter has that chapter's
 * lessons in its area. Its area wasn't done while the learner had finished every lesson it has
 * (Lucas's first chapter offered no mind map), and was current while the lesson Today opens sat in
 * the later chapter. A chapter without lessons of its own keeps its area's state.
 */
function getChapterState({
  area,
  chapterId,
  map,
}: {
  area: MapArea;
  chapterId: string;
  map: GoalMap;
}): MapArea["state"] {
  const own = map.items.filter(
    (item) => LEARN_KINDS.has(item.kind) && item.chapterId === chapterId,
  );

  return own.length === 0 ? area.state : getItemAreaState({ chapterId, map });
}

/**
 * A chapter the map files no skills under: every skill it teaches was met first in an earlier
 * chapter (an exam plan teaches one skill across chapters). It's still the plan's chapter, so it
 * gets its skills from its own items and its state from them.
 */
function buildItemArea({ chapterId, map }: { chapterId: string; map: GoalMap }) {
  const learnItems = map.items.filter((item) => LEARN_KINDS.has(item.kind));
  const inChapter = learnItems.filter((item) => item.chapterId === chapterId);
  const skillIds = new Set(inChapter.flatMap((item) => item.skillIds));

  const skills = uniqueSkills(
    map.areas.flatMap((area) => area.skills).filter((skill) => skillIds.has(skill.skillId)),
  );

  return { counts: countSkillStates(skills), skills, state: getItemAreaState({ chapterId, map }) };
}

/**
 * A chapter of the goal's plan as its page shows it, numbered in plan order, or null when the plan
 * doesn't have it. Every chapter a plan item points at has a page, so each row of the Plan opens
 * one.
 */
export function findChapterArea({
  chapterId,
  map,
}: {
  chapterId: string;
  map: GoalMap;
}): ChapterArea | null {
  const chapterAreas = map.areas.filter((area) => area.chapterId !== null);

  const order = [
    ...new Set([
      ...map.items.flatMap((item) => item.chapterId ?? []),
      ...chapterAreas.flatMap((area) => area.chapterId ?? []),
    ]),
  ];

  const index = order.indexOf(chapterId);

  if (index === -1) {
    return null;
  }

  const area = chapterAreas.find((candidate) => candidate.chapterId === chapterId);
  const position = index + 1;

  if (area) {
    return {
      counts: area.counts,
      position,
      skills: area.skills,
      state: getChapterState({ area, chapterId, map }),
    };
  }

  return { ...buildItemArea({ chapterId, map }), position };
}
