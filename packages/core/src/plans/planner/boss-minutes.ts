import { type GoalKind } from "@zoonk/db";
import { getCheckpointMinutes } from "../../checkpoints/checkpoint-minutes";
import { CHECKPOINT_QUESTIONS } from "../../checkpoints/checkpoint-rules";
import { CHECKPOINT_CALL_BLOCK_MINUTES } from "../../language/conversations/conversation-rules";
import { getBossKey } from "./plan-units";

/**
 * What each of a plan's bosses runs, in minutes, by its key (`getBossKey`), as its session plays it
 * (see `getBossSize`): null for one that can't be asked yet, which keeps its place and no time.
 */
export type BossMinutes = ReadonlyMap<string, number | null>;

/**
 * The minutes the plan keeps for a phase's boss: what it runs (`bossMinutes`), or, before the
 * question bank is read, its size then: a language goal's live call, else its full ten questions.
 */
export function getPlannedBossMinutes({
  bossMinutes,
  goalKind,
  phase,
}: {
  bossMinutes?: BossMinutes;
  goalKind: GoalKind;
  phase: number;
}): number {
  const minutes = bossMinutes?.get(getBossKey(phase));

  if (minutes !== undefined) {
    return minutes ?? 0;
  }

  return goalKind === "language"
    ? CHECKPOINT_CALL_BLOCK_MINUTES
    : getCheckpointMinutes(CHECKPOINT_QUESTIONS);
}
