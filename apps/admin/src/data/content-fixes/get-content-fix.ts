import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
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

export const getContentFix = cacheAdminData(async (id: string) => {
  const fix = await prisma.contentFix.findUnique({
    include: {
      decider: person,
      feedback: { select: { createdAt: true, id: true, message: true } },
      proposer: person,
      revertedBy: { orderBy: { createdAt: "desc" }, select: { id: true, status: true } },
      reverts: { select: { id: true } },
    },
    where: { id },
  });

  if (!fix) {
    return null;
  }

  const changes = contentFixChangesSchema.parse(fix.changes);

  const [locate, rowLabels] = await Promise.all([
    loadContentFixLocations([fix]),
    loadRowLabels(changes),
  ]);

  return {
    ...fix,
    changes,
    effects: contentFixEffectsSchema.parse(fix.effects),
    location: locate(fix),
    rowLabels,
  };
});

export type ContentFixDetail = NonNullable<Awaited<ReturnType<typeof getContentFix>>>;
