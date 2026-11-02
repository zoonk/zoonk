import { type GoalKind, type MasteryState } from "@zoonk/db";

const HIGH_EXAM_WEIGHT = 4;

type SkillBar = "learning" | "solid";

const AT_LEAST_SOLID = new Set<MasteryState>(["mastered", "solid"]);

type GoalSkill = {
  areaId: string | null;
  areaTitle: string | null;
  name: string;
  skillId: string;
  state: MasteryState;
};

type PlannedWork = { minutes: number; skillIds: readonly string[] };

type StillNeededArea = {
  areaId: string;
  left: { name: string; skillId: string }[];
  minutes: number;
  title: string;
  total: number;
};

export type StillNeeded = {
  areas: StillNeededArea[];
  left: number;
  minutes: number;
  rule: "examWeighted" | "solid";
};

const OTHER_AREA_ID = "other";

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
