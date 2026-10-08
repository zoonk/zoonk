import "server-only";
import { type TargetCutoffFinding } from "@zoonk/ai/tasks/v2/research/find-target-cutoff";
import { prisma } from "@zoonk/db";
import { getCutoffTarget } from "./cutoff-target";

/** What research needs to look up the goal's target's cut-off, once a year for everyone. */
export type TargetCutoffLookup = {
  course: string | null;
  exam: string;
  examBlueprintId: string;
  institution: string | null;
  key: string;
  position: string | null;
  year: number;
};

/**
 * The lookup a goal's target needs: the course and institution, or the position, the learner aims
 * for in a shared exam. Null when the goal names no such target, its exam is a learner's own, or
 * this year's lookup for the same target already ran (found or not): it's shared by every
 * learner aiming there.
 *
 * This is a workflow bridge: the goal comes from the research run that linked its notice.
 */
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

/**
 * Stores what this year's lookup found for the target (or that it found nothing), shared by every
 * learner aiming there, so it isn't looked up again until next year. A lookup that ran twice at
 * once keeps the first answer.
 *
 * This is a workflow bridge: the lookup comes from `findTargetCutoffLookup`.
 */
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
