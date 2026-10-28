import { type CourseLevel } from "@zoonk/db";
import { getBandRank } from "../../learner/placement/placement-graph";
import { type OwnLevel } from "../../learner/placement/placement-steps";
import { getSkillArea } from "../planner/graph-areas";
import { type PlanGraph } from "../planner/plan-state";
import { type PlannerLesson } from "../planner/plan-units";

export function getLevelFloor(level: OwnLevel | null): CourseLevel | null {
  if (level === "intermediate" || level === "advanced") {
    return level;
  }

  return null;
}

function isBelow({ band, floor }: { band: CourseLevel | null | undefined; floor: CourseLevel }) {
  return band !== null && band !== undefined && getBandRank(band) < getBandRank(floor);
}

function keepLevelBands<TLesson extends Pick<PlannerLesson, "band" | "skillIds">>({
  floor,
  lessons,
}: {
  floor: CourseLevel | null;
  lessons: readonly TLesson[];
}): TLesson[] {
  if (!floor) {
    return [...lessons];
  }

  const atLevel = new Set(
    lessons
      .filter((lesson) => !isBelow({ band: lesson.band, floor }))
      .flatMap((lesson) => lesson.skillIds),
  );

  return lessons.filter(
    (lesson) =>
      !isBelow({ band: lesson.band, floor }) ||
      !lesson.skillIds.every((skillId) => atLevel.has(skillId)),
  );
}

const PAST_BASICS_FLOOR: CourseLevel = "intermediate";

export function keepPastBasicsBands({
  graph,
  keepSkillIds = new Set(),
  lessons,
  pastBasicsAreas,
}: {
  graph: PlanGraph;
  keepSkillIds?: ReadonlySet<string>;
  lessons: PlannerLesson[];
  pastBasicsAreas: readonly string[];
}): PlannerLesson[] {
  const areas = new Set(pastBasicsAreas);

  const skillIds = new Set(
    graph.skills
      .filter(
        (skill) => areas.has(getSkillArea({ graph, skill })) && !keepSkillIds.has(skill.skillId),
      )
      .map((skill) => skill.skillId),
  );

  if (skillIds.size === 0) {
    return lessons;
  }

  const isPastBasics = (lesson: PlannerLesson) => lesson.skillIds.some((id) => skillIds.has(id));

  const kept = new Set(
    keepLevelBands({
      floor: PAST_BASICS_FLOOR,
      lessons: lessons.filter((lesson) => isPastBasics(lesson)),
    }),
  );

  return lessons.filter((lesson) => !isPastBasics(lesson) || kept.has(lesson));
}
