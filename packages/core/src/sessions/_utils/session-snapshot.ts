import { MasteryState } from "@zoonk/db";
import { z } from "zod";
import { brainPowerRewardSchema } from "../../milestones/milestone-reward";

const MASTERY_RANK: Readonly<Record<MasteryState, number>> = {
  learning: 1,
  mastered: 3,
  new: 0,
  solid: 2,
};

const rewardSchema = z.enum(["solid", "mastered"]);

const sessionStateSchema = z.object({
  brainPower: z.number(),
  energy: z.number(),
  preparation: z.number().nullable(),
  progress: z.number().nullable(),
  skillStates: z.record(z.string(), z.enum(MasteryState)),
});

export type SessionState = z.infer<typeof sessionStateSchema>;

/** Retain paid mastery bonuses so a skill that declines and recovers is never rewarded twice in a session. */
const sessionSnapshotSchema = sessionStateSchema.extend({
  fullMealReward: brainPowerRewardSchema.optional(),
  fullMealSource: z.object({ id: z.string(), kind: z.string() }).optional(),
  masteryRewards: z.record(z.string(), rewardSchema).default({}),
});

/** A full meal paid before the session's first block started leaves only its reward here. */
const fullMealSnapshotSchema = z.object({ fullMealReward: brainPowerRewardSchema });

export function readFullMealReward(value: unknown) {
  return fullMealSnapshotSchema.safeParse(value).data?.fullMealReward ?? null;
}

export type SessionSnapshot = z.infer<typeof sessionSnapshotSchema>;

export function readSessionSnapshot(value: unknown): SessionSnapshot | null {
  const parsed = sessionSnapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function readSessionEnd(value: unknown): SessionState | null {
  const parsed = sessionStateSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

type MasteryRewards = { mastered: string[]; solid: string[] };

function isRewardDue({
  current,
  paid,
  reward,
  start,
}: {
  current: MasteryState;
  paid: SessionSnapshot["masteryRewards"][string] | undefined;
  reward: "mastered" | "solid";
  start: MasteryState;
}): boolean {
  const reached = current === reward;
  const rose = MASTERY_RANK[current] > MASTERY_RANK[start];
  const alreadyPaid = paid !== undefined && MASTERY_RANK[paid] >= MASTERY_RANK[reward];

  return reached && rose && !alreadyPaid;
}

/** A skill jumping straight to Mastered earns only the Mastered bonus; exclude bonuses already paid this session. */
export function getMasteryRewards({
  current,
  snapshot,
}: {
  current: Readonly<Record<string, MasteryState>>;
  snapshot: SessionSnapshot;
}): MasteryRewards {
  const entries = Object.entries(current).map(([skillId, state]) => ({
    current: state,
    paid: snapshot.masteryRewards[skillId],
    skillId,
    start: snapshot.skillStates[skillId] ?? "new",
  }));

  const due = (reward: "mastered" | "solid") =>
    entries.filter((entry) => isRewardDue({ ...entry, reward })).map((entry) => entry.skillId);

  return { mastered: due("mastered"), solid: due("solid") };
}

export function withPaidRewards({
  rewards,
  snapshot,
}: {
  rewards: MasteryRewards;
  snapshot: SessionSnapshot;
}): SessionSnapshot {
  return {
    ...snapshot,
    masteryRewards: {
      ...snapshot.masteryRewards,
      ...Object.fromEntries(rewards.solid.map((skillId) => [skillId, "solid" as const])),
      ...Object.fromEntries(rewards.mastered.map((skillId) => [skillId, "mastered" as const])),
    },
  };
}

export function getMovedSkills({
  current,
  snapshot,
}: {
  current: Readonly<Record<string, MasteryState>>;
  snapshot: SessionSnapshot;
}): { from: MasteryState; skillId: string; to: MasteryState }[] {
  return Object.entries(current)
    .map(([skillId, to]) => ({ from: snapshot.skillStates[skillId] ?? "new", skillId, to }))
    .filter((move) => MASTERY_RANK[move.to] > MASTERY_RANK[move.from])
    .toSorted(
      (a, b) =>
        MASTERY_RANK[b.to] - MASTERY_RANK[b.from] - (MASTERY_RANK[a.to] - MASTERY_RANK[a.from]),
    );
}
