import "server-only";
import { prisma } from "@zoonk/db";
import { getOutlineStaleBefore } from "./outline-ahead";

/** `askedAt` tells this ask from a later one, so an earlier run ending never clears a new ask. */
export type SkillOutlineAskRef = { askedAt: number; goalId: string; skillId: string };

export async function hasFreshSkillOutlineAsk({
  goalId,
  now = new Date(),
  skillId,
}: {
  goalId: string;
  now?: Date;
  skillId: string;
}): Promise<boolean> {
  const asks = await prisma.skillOutlineAsk.count({
    where: { askedAt: { gt: getOutlineStaleBefore(now) }, goalId, skillId },
  });

  return asks > 0;
}

/** Null while another fresh ask for the topic is still being written, so only one request starts the run. */
export async function takeSkillOutlineAsk({
  goalId,
  now,
  skillId,
}: {
  goalId: string;
  now: Date;
  skillId: string;
}): Promise<SkillOutlineAskRef | null> {
  const taken = await prisma.$queryRaw<unknown[]>`
    INSERT INTO skill_outline_asks (goal_id, skill_id, asked_at)
    VALUES (${goalId}::uuid, ${skillId}::uuid, ${now})
    ON CONFLICT (goal_id, skill_id) DO UPDATE SET asked_at = EXCLUDED.asked_at
    WHERE skill_outline_asks.asked_at <= ${getOutlineStaleBefore(now)}
    RETURNING 1
  `;

  return taken.length > 0 ? { askedAt: now.getTime(), goalId, skillId } : null;
}

/** The outline run the ask started ended, written or not, or never started. */
export async function endSkillOutlineAsk({ askedAt, goalId, skillId }: SkillOutlineAskRef) {
  await prisma.skillOutlineAsk.deleteMany({
    where: { askedAt: new Date(askedAt), goalId, skillId },
  });
}
