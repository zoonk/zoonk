import "server-only";
import { type Goal } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { type GoalPlan } from "../../learner/_utils/goal-skill-graph";
import { loadPreparationInputs } from "../../preparation/_utils/load-preparation-inputs";
import { getAreaPreparations } from "../../preparation/area-preparation";
import { type MissionFactBlock, toBlockPick } from "./block-candidates";
import { MISSION_RULES, type MissionPick } from "./catalog";

const WEEK_DAYS = 7;

export async function weakSpotCandidate({
  blocks,
  goal,
  goalPlan,
  now,
  plannedMinutes,
  userId,
}: {
  blocks: readonly MissionFactBlock[];
  goal: Goal;
  goalPlan: GoalPlan;
  now: Date;
  plannedMinutes: number;
  userId: string;
}): Promise<MissionPick | null> {
  const practice = blocks.find((block) => block.kind === "practice" && !block.payload.extra);

  if (goal.kind === "language" || plannedMinutes < MISSION_RULES.roomyDayMinutes || !practice) {
    return null;
  }

  const inputs = await loadPreparationInputs({
    goal,
    goalId: goal.id,
    now,
    readPlan: async () => goalPlan,
    userId,
  });

  const areas = getAreaPreparations({
    ...inputs,
    now,
    weekAgo: new Date(now.getTime() - WEEK_DAYS * MS_PER_DAY),
  });

  const area = areas.areas.find(
    (entry) => entry.areaId === areas.weakestAreaId && entry.needsPractice,
  );

  const areaSkillIds = new Set(
    goalPlan.skills.filter((skill) => skill.areaId === area?.areaId).map((skill) => skill.id),
  );

  if (!area || !practice.payload.skillIds.some((id) => areaSkillIds.has(id))) {
    return null;
  }

  return {
    ...toBlockPick({ block: practice, kind: "weakSpot" }),
    anchor: {
      areaId: area.areaId,
      blockKind: "practice",
      skillIds: practice.payload.skillIds.filter((id) => areaSkillIds.has(id)),
    },
    detail: { areaTitle: area.title, minutes: practice.estimatedMinutes },
  };
}
