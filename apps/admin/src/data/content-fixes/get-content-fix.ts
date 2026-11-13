import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { batchOf, batchWhere } from "@zoonk/core/staff/content-fixes/batches";
import {
  type StoredChange,
  contentFixChangesSchema,
  contentFixEffectsSchema,
} from "@zoonk/core/staff/content-fixes/contract";
import { prisma } from "@zoonk/db";
import { loadContentFixLocations } from "./content-fix-locations";

const person = { select: { email: true, id: true, name: true } } as const;

function idsOf(changes: readonly StoredChange[], model: StoredChange["model"]): string[] {
  return changes.filter((change) => change.model === model).map((change) => change.id);
}

function screenLabel(step: { kind: string; position: number }): string {
  return `Screen ${String(step.position + 1)} · ${step.kind}`;
}

/** What each changed row is, in the reviewer's terms. A row deleted since has no label. */
async function loadRowLabels(changes: readonly StoredChange[]): Promise<Map<string, string>> {
  const [steps, variants, explanations] = await Promise.all([
    prisma.step.findMany({
      select: { id: true, kind: true, position: true },
      where: { id: { in: idsOf(changes, "Step") } },
    }),
    prisma.stepVariant.findMany({
      select: { id: true, key: true, kind: true, step: { select: { kind: true, position: true } } },
      where: { id: { in: idsOf(changes, "StepVariant") } },
    }),
    prisma.answerExplanation.findMany({
      select: { id: true, step: { select: { kind: true, position: true } } },
      where: { id: { in: idsOf(changes, "AnswerExplanation") } },
    }),
  ]);

  return new Map([
    ...steps.map((step): [string, string] => [step.id, screenLabel(step)]),
    ...variants.map((variant): [string, string] => [
      variant.id,
      `${screenLabel(variant.step)} · ${variant.kind}${variant.key ? ` ${variant.key}` : ""} version`,
    ]),
    ...explanations.map((explanation): [string, string] => [
      explanation.id,
      explanation.step
        ? `Answer explanation · ${screenLabel(explanation.step)}`
        : "Answer explanation · practice question",
    ]),
  ]);
}

const fixInclude = {
  decider: person,
  feedback: { select: { createdAt: true, id: true, message: true } },
  proposer: person,
  revertedBy: { orderBy: { createdAt: "desc" }, select: { id: true, status: true } },
  reverts: { select: { id: true } },
} as const;

function findFixes(where: { id: string } | ReturnType<typeof batchWhere>) {
  return prisma.contentFix.findMany({ include: fixInclude, orderBy: { id: "asc" }, where });
}

type FixRow = Awaited<ReturnType<typeof findFixes>>[number];

async function toDetails(fixes: readonly FixRow[]) {
  const changes = fixes.map((fix) => contentFixChangesSchema.parse(fix.changes));

  const [locate, rowLabels] = await Promise.all([
    loadContentFixLocations(fixes),
    loadRowLabels(changes.flat()),
  ]);

  return fixes.map((fix, index) => ({
    ...fix,
    batchId: batchOf(fix),
    changes: changes[index] ?? [],
    effects: contentFixEffectsSchema.parse(fix.effects),
    location: locate(fix),
    rowLabels,
  }));
}

export type ContentFixDetail = Awaited<ReturnType<typeof toDetails>>[number];

export const getContentFix = cacheAdminData(async (id: string) => {
  const [fix] = await findFixes({ id });

  if (!fix) {
    return null;
  }

  const [[detail], batchSize] = await Promise.all([
    toDetails([fix]),
    prisma.contentFix.count({ where: batchWhere(batchOf(fix)) }),
  ]);

  return detail ? { ...detail, batchSize } : null;
});

/** Every fix proposed together, in the order the proposal listed them. */
export const getContentFixBatch = cacheAdminData(async (batchId: string) => {
  const fixes = await findFixes(batchWhere(batchId));

  return fixes.length > 0 ? toDetails(fixes) : null;
});
