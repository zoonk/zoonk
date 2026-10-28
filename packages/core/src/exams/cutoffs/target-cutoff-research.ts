import "server-only";
import { type TargetCutoffFinding } from "@zoonk/ai/tasks/v2/research/find-target-cutoff";
import { prisma } from "@zoonk/db";
import { getCutoffTarget } from "./cutoff-target";

export type TargetCutoffLookup = {
  course: string | null;
  exam: string;
  examBlueprintId: string;
  institution: string | null;
  key: string;
  position: string | null;
  year: number;
};

/** Internal workflow bridge: the goal must come from the research run that linked its notice. */
export async function findTargetCutoffLookup({
  goalId,
  year,
}: {
  goalId: string;
  year: number;
}): Promise<TargetCutoffLookup | null> {
  const goal = await prisma.goal.findUnique({
    select: { details: true, examBlueprint: true, kind: true },
    where: { id: goalId },
  });

  const blueprint = goal?.examBlueprint;

  if (goal?.kind !== "exam" || !blueprint || blueprint.ownerId) {
    return null;
  }

  const target = getCutoffTarget({ details: goal.details, role: blueprint.role });

  if (!target) {
    return null;
  }

  const done = await prisma.targetCutoff.findUnique({
    select: { id: true },
    where: { blueprintTargetYear: { examBlueprintId: blueprint.id, targetKey: target.key, year } },
  });

  return done
    ? null
    : {
        ...target,
        exam: blueprint.role ? `${blueprint.name}, ${blueprint.role}` : blueprint.name,
        examBlueprintId: blueprint.id,
        year,
      };
}

/** Internal workflow bridge: the lookup must come from `findTargetCutoffLookup`. */
export async function recordTargetCutoff({
  finding,
  lookup,
  provenance,
}: {
  finding: TargetCutoffFinding;
  lookup: TargetCutoffLookup;
  provenance: { model: string; promptVersion: string; runId: string };
}): Promise<void> {
  await prisma.targetCutoff.createMany({
    data: {
      edition: finding.edition,
      examBlueprintId: lookup.examBlueprintId,
      maxScore: finding.maxScore,
      model: provenance.model,
      promptVersion: provenance.promptVersion,
      quota: finding.quota,
      runId: provenance.runId,
      score: finding.score,
      sourceTitle: finding.source?.title ?? null,
      sourceUrl: finding.source?.url ?? null,
      status: finding.status,
      targetKey: lookup.key,
      year: lookup.year,
    },
    skipDuplicates: true,
  });
}
