import "server-only";
import { type ExamBlueprint, prisma } from "@zoonk/db";
import { examStructureSchema } from "../../library/exams/blueprint-contract";
import { type CutoffTarget, getCutoffTarget } from "./cutoff-target";
import { type TargetCutoff } from "./target-cutoff-contract";

type NoticeScale = { max: number; min: number } | null;

/**
 * The top of the scale a cut-off is on: the one its source stated, else the scale the notice
 * reports the result on, when the score fits it. Null when neither says: "7" alone could be out of
 * 10 or 100, so it isn't shown.
 */
function findMaxScore({
  maxScore,
  noticeScale,
  score,
}: {
  maxScore: number | null;
  noticeScale: NoticeScale;
  score: number;
}): number | null {
  if (maxScore !== null) {
    return maxScore;
  }

  return noticeScale && score >= noticeScale.min && score <= noticeScale.max
    ? noticeScale.max
    : null;
}

/**
 * The latest cut-off a lookup found for the goal's target in this exam (a year's lookup that found
 * none leaves the one before, which names its own edition), with the scale it's on. Null without a
 * target, a shared exam, a found cut-off or its scale: nothing is guessed.
 */
export async function loadTargetCutoff({
  blueprint: knownBlueprint,
  details,
  examBlueprintId,
}: {
  blueprint?: Pick<ExamBlueprint, "ownerId" | "role" | "structure"> | null;
  details: unknown;
  examBlueprintId: string | null | undefined;
}): Promise<TargetCutoff | null> {
  if (!examBlueprintId) {
    return null;
  }

  const blueprint =
    knownBlueprint === undefined
      ? await prisma.examBlueprint.findUnique({
          select: { ownerId: true, role: true, structure: true },
          where: { id: examBlueprintId },
        })
      : knownBlueprint;

  const target =
    blueprint && !blueprint.ownerId ? getCutoffTarget({ details, role: blueprint.role }) : null;

  if (!target) {
    return null;
  }

  const noticeScale =
    examStructureSchema.safeParse(blueprint?.structure).data?.mock?.scoring.scale ?? null;

  return findCutoff({ examBlueprintId, noticeScale, target });
}

async function findCutoff({
  examBlueprintId,
  noticeScale,
  target,
}: {
  examBlueprintId: string;
  noticeScale: NoticeScale;
  target: CutoffTarget;
}): Promise<TargetCutoff | null> {
  const row = await prisma.targetCutoff.findFirst({
    orderBy: { year: "desc" },
    where: { examBlueprintId, status: "found", targetKey: target.key },
  });

  if (!row || row.score === null || !row.sourceUrl) {
    return null;
  }

  const maxScore = findMaxScore({ maxScore: row.maxScore, noticeScale, score: row.score });

  if (maxScore === null) {
    return null;
  }

  return {
    course: target.course,
    edition: row.edition,
    institution: target.institution,
    maxScore,
    position: target.position,
    quota: row.quota,
    score: row.score,
    source: { title: row.sourceTitle, url: row.sourceUrl },
  };
}
