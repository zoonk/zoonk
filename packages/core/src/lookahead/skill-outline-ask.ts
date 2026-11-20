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
  const created = await prisma.skillOutlineAsk.createMany({
    data: { askedAt: now, goalId, skillId },
    skipDuplicates: true,
  });

  const ask = { askedAt: now.getTime(), goalId, skillId };

  if (created.count > 0) {
    return ask;
  }

  const renewed = await prisma.skillOutlineAsk.updateMany({
    data: { askedAt: now },
    where: { askedAt: { lte: getOutlineStaleBefore(now) }, goalId, skillId },
  });

  return renewed.count > 0 ? ask : null;
}

/** Workflow bridge: the outline run the ask started ended, written or not. */
export async function endSkillOutlineAsk({ askedAt, goalId, skillId }: SkillOutlineAskRef) {
  await prisma.skillOutlineAsk.deleteMany({
    where: { askedAt: new Date(askedAt), goalId, skillId },
  });
}
