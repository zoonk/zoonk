import { type PlanItem } from "@zoonk/db";
import { countSkillStates } from "../../../learner/mastery-state";
import { isWorkFinished } from "../../../plans/_utils/work-progress";
import { type GoalMap } from "../../_utils/goal-map";
import { type MapArea, type MapSkill } from "../../map/map-contract";

const LEARN_KINDS = new Set<PlanItem["kind"]>(["chapter", "lesson"]);

export type ChapterArea = Pick<MapArea, "counts" | "skills" | "state"> & { position: number };

function uniqueSkills(skills: readonly MapSkill[]): MapSkill[] {
  return skills.filter(
    (skill, index) => skills.findIndex((other) => other.skillId === skill.skillId) === index,
  );
}

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

/** Use the chapter's own lessons: a shared skill's map area may include later chapters; only empty chapters inherit area state. */
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

/** Shared skills may all belong to earlier map areas; the later chapter still needs an area from its own items. */
function buildItemArea({ chapterId, map }: { chapterId: string; map: GoalMap }) {
  const learnItems = map.items.filter((item) => LEARN_KINDS.has(item.kind));
  const inChapter = learnItems.filter((item) => item.chapterId === chapterId);
  const skillIds = new Set(inChapter.flatMap((item) => item.skillIds));

  const skills = uniqueSkills(
    map.areas.flatMap((area) => area.skills).filter((skill) => skillIds.has(skill.skillId)),
  );

  return { counts: countSkillStates(skills), skills, state: getItemAreaState({ chapterId, map }) };
}

/** Returns null outside the plan; every chapter referenced by a plan item must still have a page. */
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
