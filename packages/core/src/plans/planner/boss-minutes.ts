import { type GoalKind } from "@zoonk/db";
import { getCheckpointMinutes } from "../../checkpoints/checkpoint-minutes";
import { CHECKPOINT_QUESTIONS } from "../../checkpoints/checkpoint-rules";
import { CHECKPOINT_CALL_BLOCK_MINUTES } from "../../language/conversations/conversation-rules";
import { getBossKey } from "./plan-units";

export type BossMinutes = ReadonlyMap<string, number | null>;

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
