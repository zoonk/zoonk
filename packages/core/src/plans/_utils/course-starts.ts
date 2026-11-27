import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { parsePlanChangePayload } from "./plan-change-payload";

export async function loadCourseStarts(goalId: string, tx: TransactionClient = prisma) {
  const changes = await tx.planChange.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { createdAt: true, id: true, kind: true, payload: true },
    where: { kind: { in: ["testedOut", "relearn"] }, plan: { goalId }, status: "applied" },
  });

  const starts = new Map<string, { at: Date; changeId: string }>();

  for (const change of changes) {
    const payload = parsePlanChangePayload(change.payload);

    if (change.kind === "relearn") {
      for (const id of payload.recheckedSkillIds) {starts.delete(id);}
    } else {
      for (const id of payload.startedPastSkillIds ?? [])
        {starts.set(id, { at: change.createdAt, changeId: change.id });}
    }
  }

  return starts;
}

export async function priorityCourseStarts(
  goalId: string,
  starts: ReadonlyMap<string, { at: Date }>,
  tx: TransactionClient = prisma,
) {
  if (starts.size === 0) {return [];}
  const next = await tx.planItem.findFirst({
    orderBy: { position: "asc" },
    select: { id: true, scheduledFor: true },
    where: { kind: "lesson", plan: { goalId }, status: "todo" },
  });

  if (!next) {return [];}
  const lessons = await tx.planItem.findMany({
    select: { lesson: { select: { skills: { select: { skillId: true } } } }, skillId: true },
    where: {
      kind: "lesson",
      plan: { goalId },
      status: "todo",
      ...(next.scheduledFor ? { scheduledFor: next.scheduledFor } : { id: next.id }),
    },
  });

  const skillIds = lessons.flatMap((row) => [
    ...(row.skillId ? [row.skillId] : []),
    ...(row.lesson?.skills.map((skill) => skill.skillId) ?? []),
  ]);

  const edges = await tx.skillPrerequisite.findMany({
    select: { prerequisiteId: true },
    where: { prerequisiteId: { in: [...starts.keys()] }, skillId: { in: skillIds } },
  });

  return [...new Set(edges.map((edge) => edge.prerequisiteId))];
}
