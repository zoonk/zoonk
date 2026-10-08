import { type CourseLevel } from "@zoonk/db";
import { getBandRank } from "../../learner/placement/placement-graph";
import { type OwnLevel } from "../../learner/placement/placement-steps";
import { getSkillArea } from "../planner/graph-areas";
import { type PlanGraph } from "../planner/plan-state";
import { type PlannerLesson } from "../planner/plan-units";

/**
 * The Library band a learner's own level starts at: someone who studied the subject before
 * starts at its intermediate chapters, someone who knows it well at its advanced ones. Null when
 * every band is theirs.
 */
export function getLevelFloor(level: OwnLevel | null): CourseLevel | null {
  if (level === "intermediate" || level === "advanced") {
    return level;
  }

  return null;
}

function isBelow({ band, floor }: { band: CourseLevel | null | undefined; floor: CourseLevel }) {
  return band !== null && band !== undefined && getBandRank(band) < getBandRank(floor);
}

/**
 * Leaves out the lessons of a band below the learner's level when every skill they teach is also
 * taught at that level or above: a skill the Library teaches in a beginner and an intermediate
 * chapter takes only the intermediate one for someone who studied it before. A skill taught only
 * in an easier band keeps those lessons, so no skill loses its lessons.
 */
export function keepLevelBands<TLesson extends Pick<PlannerLesson, "band" | "skillIds">>({
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

/** The band an area the learner said they're past the basics of starts at. */
const PAST_BASICS_FLOOR: CourseLevel = "intermediate";

/**
 * The lessons of the areas the learner said they're past the basics of keep only their higher
 * bands where a skill is also taught there (`keepLevelBands`); other areas' lessons stay as they are.
 */
export function keepPastBasicsBands({
  graph,
  lessons,
  pastBasicsAreas,
}: {
  graph: PlanGraph;
  lessons: PlannerLesson[];
  pastBasicsAreas: readonly string[];
}): PlannerLesson[] {
  const areas = new Set(pastBasicsAreas);

  const skillIds = new Set(
    graph.skills
      .filter((skill) => areas.has(getSkillArea({ graph, skill })))
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
