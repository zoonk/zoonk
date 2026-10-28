import "server-only";
import { type ExamBlueprint, prisma } from "@zoonk/db";
import { examStructureSchema } from "../../library/exams/blueprint-contract";
import { type CutoffTarget, getCutoffTarget } from "./cutoff-target";
import { type TargetCutoff } from "./target-cutoff-contract";

type NoticeScale = { max: number; min: number } | null;

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
