import { MasteryState } from "@zoonk/db";
import { z } from "zod";

const MASTERY_RANK: Readonly<Record<MasteryState, number>> = {
  learning: 1,
  mastered: 3,
  new: 0,
  solid: 2,
};

const rewardSchema = z.enum(["solid", "mastered"]);

/** Where the learner stands at one moment: Brain Power, Energy, preparation and skill states. */
const sessionStateSchema = z.object({
  brainPower: z.number(),
  energy: z.number(),
  preparation: z.number().nullable(),
  skillStates: z.record(z.string(), z.enum(MasteryState)),
});

export type SessionState = z.infer<typeof sessionStateSchema>;

/**
 * Where the learner stood when the session's first block started, so its end can say what
 * changed: Brain Power (belt stripes), Energy, preparation and each goal skill's state. It also
 * remembers which skills already earned their Solid or Mastered bonus this session, so a skill
 * that wobbles and recovers is never paid twice.
 */
const sessionSnapshotSchema = sessionStateSchema.extend({
  masteryRewards: z.record(z.string(), rewardSchema).default({}),
});

export type SessionSnapshot = z.infer<typeof sessionSnapshotSchema>;

export function readSessionSnapshot(value: unknown): SessionSnapshot | null {
  const parsed = sessionSnapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Where the learner stood when the session ended (its `endSnapshot`), if it ended. */
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

/**
 * Skills that reached Solid or Mastered during the session and haven't earned that bonus yet.
 * A skill that jumps straight to Mastered earns the Mastered bonus only.
 */
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

/** The snapshot after paying mastery bonuses, so later blocks don't pay them again. */
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

/** Skills whose state rose during the session, the biggest moves first. */
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
