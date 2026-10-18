import { type GoalKind, type MasteryState } from "@zoonk/db";

/**
 * Exam skills weighted 4 or 5 (of 5) carry a large share of the points, so they must be Solid
 * before the goal counts as reached; lighter ones only need to be Learning or better.
 */
const HIGH_EXAM_WEIGHT = 4;

/** The state a skill must reach: Solid (remembered a week out), or at least Learning. */
type SkillBar = "learning" | "solid";

const AT_LEAST_SOLID = new Set<MasteryState>(["mastered", "solid"]);

/** One of the goal's skills with its area, in plan order. */
type GoalSkill = {
  areaId: string | null;
  areaTitle: string | null;
  name: string;
  skillId: string;
  state: MasteryState;
};

/** A plan item still to do, with the study time the planner gives it at the learner's pace. */
type PlannedWork = { minutes: number; skillIds: readonly string[] };

/** One area of the goal with the skills still below their bar and the time the plan gives them. */
type StillNeededArea = {
  areaId: string;
  left: { name: string; skillId: string }[];
  /** Study time the plan still has for these skills at the learner's pace, reviews included. */
  minutes: number;
  title: string;
  total: number;
};

/**
 * "Still needed to reach your goal": what separates the learner from their goal, area by area.
 * Never a promise of a result, only the skills left and the time the plan gives them.
 */
export type StillNeeded = {
  areas: StillNeededArea[];
  left: number;
  minutes: number;
  /** `solid` for every skill, or `examWeighted`: high-weight skills Solid, the rest Learning. */
  rule: "examWeighted" | "solid";
};

/** Skills outside a plan area share one row, as they do in Progress and Content. */
const OTHER_AREA_ID = "other";

/**
 * The state a goal's skill must reach: Solid for every skill of a learn goal and for an exam's
 * high-weight skills, Learning for an exam's lighter ones.
 */
function getSkillBar({
  goalKind,
  weight,
}: {
  goalKind: GoalKind;
  weight: number | null;
}): SkillBar {
  if (goalKind !== "exam") {
    return "solid";
  }

  return weight !== null && weight >= HIGH_EXAM_WEIGHT ? "solid" : "learning";
}

function isBelowBar({ bar, state }: { bar: SkillBar; state: MasteryState }): boolean {
  return bar === "solid" ? !AT_LEAST_SOLID.has(state) : state === "new";
}

/** Each planned item's time goes evenly to the skills it teaches that are still needed. */
function getMinutesBySkill({
  needed,
  work,
}: {
  needed: ReadonlySet<string>;
  work: readonly PlannedWork[];
}): Map<string, number> {
  const shares = work.flatMap((item) =>
    item.skillIds
      .filter((skillId) => needed.has(skillId))
      .map((skillId) => ({ minutes: item.minutes / item.skillIds.length, skillId })),
  );

  return new Map(
    [...Map.groupBy(shares, (share) => share.skillId)].map(([skillId, items]) => [
      skillId,
      items.reduce((total, item) => total + item.minutes, 0),
    ]),
  );
}

/**
 * Builds what's still needed from the goal's skills in plan order: every skill below its bar
 * (Solid, or for exams Solid only when it weighs a lot and Learning otherwise), grouped by area in
 * plan order, with the minutes the plan's remaining items give them. Areas already at the bar stay
 * in the list with nothing left, so the learner sees what they've covered.
 */
export function buildStillNeeded({
  goalKind,
  skills,
  weights,
  work,
}: {
  goalKind: GoalKind;
  skills: readonly GoalSkill[];
  weights: ReadonlyMap<string, number | null>;
  work: readonly PlannedWork[];
}): StillNeeded {
  const left = skills.filter((skill) =>
    isBelowBar({
      bar: getSkillBar({ goalKind, weight: weights.get(skill.skillId) ?? null }),
      state: skill.state,
    }),
  );

  const leftIds = new Set(left.map((skill) => skill.skillId));
  const minutesBySkill = getMinutesBySkill({ needed: leftIds, work });
  const byArea = Map.groupBy(skills, (skill) => skill.areaId ?? OTHER_AREA_ID);

  const areas = [...byArea].map(([areaId, inArea]) => {
    const areaLeft = inArea.filter((skill) => leftIds.has(skill.skillId));

    const minutes = areaLeft.reduce(
      (sum, skill) => sum + (minutesBySkill.get(skill.skillId) ?? 0),
      0,
    );

    return {
      areaId,
      left: areaLeft.map(({ name, skillId }) => ({ name, skillId })),
      minutes: Math.round(minutes),
      title: inArea[0]?.areaTitle ?? "",
      total: inArea.length,
    };
  });

  return {
    areas,
    left: left.length,
    minutes: areas.reduce((sum, area) => sum + area.minutes, 0),
    rule: goalKind === "exam" ? "examWeighted" : "solid",
  };
}
