import "server-only";
import { type QuestionFormat } from "@zoonk/ai/tasks/v2/research/extract-question-formats";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { type ExamStructure, examStructureSchema, toAnswerFormat } from "./blueprint-contract";
import { type ExtractionDocument } from "./blueprint-passages";
import { isPassageInDocument } from "./passage-check";

const noticeFormatsSchema = examStructureSchema.shape.formats;

export type NoticeFormats = Pick<ExamStructure, "formats" | "pastOptions">;

export function readNoticeFormats(details: unknown): NoticeFormats | null {
  const stored = isJsonObject(details) ? details.noticeFormats : null;
  const formats = noticeFormatsSchema.safeParse(stored).data;

  return formats && formats.length > 0 ? { formats, pastOptions: null } : null;
}

function toCitedFormat({
  documents,
  format,
}: {
  documents: readonly ExtractionDocument[];
  format: QuestionFormat;
}): ExamStructure["formats"][number] | null {
  const document = documents[format.document - 1];

  const found =
    document?.text && isPassageInDocument({ passage: format.passage, text: document.text });

  return document && found
    ? {
        citation: { passage: format.passage, sourceId: document.sourceId },
        description: format.description,
        kind: format.kind,
        options: format.options,
        ...toAnswerFormat(format),
      }
    : null;
}

/** Internal workflow bridge: the goal must belong to the research run. */
export async function recordGoalNoticeFormats({
  documents,
  formats,
  goalId,
}: {
  documents: readonly ExtractionDocument[];
  formats: readonly QuestionFormat[];
  goalId: string;
}): Promise<void> {
  const cited = formats
    .map((format) => toCitedFormat({ documents, format }))
    .filter((format) => format !== null);

  if (cited.length === 0) {
    return;
  }

  const goal = await prisma.goal.findUnique({ where: { id: goalId } });

  if (!goal) {
    return;
  }

  await writeLearnerChange({ userId: goal.userId }, async (tx) => {
    const count = await tx.$executeRaw`
      UPDATE goals
      SET details = jsonb_set(details, '{noticeFormats}', ${JSON.stringify(cited)}::jsonb)
      WHERE id = ${goalId}::uuid
        AND details->'noticeFormats' IS DISTINCT FROM ${JSON.stringify(cited)}::jsonb
    `;

    if (count === 0) {
      return unchanged(null);
    }
  });
}

export function awaitsExamBlueprint(
  goal: Pick<Goal, "examBlueprintId" | "kind" | "targetLanguage">,
): boolean {
  return goal.kind === "exam" && goal.targetLanguage !== null && goal.examBlueprintId === null;
}

/** Internal workflow bridge: the goal must belong to the research run. */
export async function getPlacementExamWait(
  goalId: string,
): Promise<"blueprint" | "formats" | null> {
  const goal = await prisma.goal.findUnique({
    select: {
      details: true,
      examBlueprintId: true,
      kind: true,
      plan: { select: { noticeWaitEndedAt: true } },
      targetLanguage: true,
    },
    where: { id: goalId },
  });

  if (!goal) {
    return null;
  }

  if (awaitsExamBlueprint(goal)) {
    return goal.plan?.noticeWaitEndedAt ? null : "blueprint";
  }

  return goal.examBlueprintId || readNoticeFormats(goal.details) ? null : "formats";
}
