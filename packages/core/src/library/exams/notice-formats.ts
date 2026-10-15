import "server-only";
import { type QuestionFormat } from "@zoonk/ai/tasks/v2/research/extract-question-formats";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { type ExamStructure, examStructureSchema, toAnswerFormat } from "./blueprint-contract";
import { type ExtractionDocument } from "./blueprint-passages";
import { isPassageInDocument } from "./passage-check";

/** The exam's formats as a goal keeps them, until its notice's blueprint is linked. */
const noticeFormatsSchema = examStructureSchema.shape.formats;

/** What a goal knows of its exam's question formats before the notice is read: only those. */
export type NoticeFormats = Pick<ExamStructure, "formats" | "pastOptions">;

/** The formats a first pass over the notice read, stored on the goal; null without them. */
export function readNoticeFormats(details: unknown): NoticeFormats | null {
  const stored = isJsonObject(details) ? details.noticeFormats : null;
  const formats = noticeFormatsSchema.safeParse(stored).data;

  return formats && formats.length > 0 ? { formats, pastOptions: null } : null;
}

/** A format the reading quoted from a document code finds the passage in. */
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

/**
 * Keeps on the goal the question formats a first pass over its exam's new notice read (in
 * seconds, while the whole notice takes minutes), each only when code finds its passage, so
 * placement's first questions follow the exam (Cebraspe's statements judged right or wrong, FGV's
 * four options) before the notice's blueprint is linked; the blueprint's formats replace them
 * then. This is a workflow bridge: the goal is the one research works for.
 */
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
    // Merged in place: onboarding writes the learner's answers into the same details meanwhile.
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

/**
 * Whether placement waits for a goal's exam blueprint before writing or asking questions: a
 * language certificate (an exam goal with a target language, such as IELTS) whose notice research
 * hasn't linked yet. Which of its skills only recordings practice comes from the blueprint's
 * listening section (`getListeningSkillIds`), so an IELTS candidate's questions written before the
 * link tested listening with text, and placement asked them.
 */
export function awaitsExamBlueprint(
  goal: Pick<Goal, "examBlueprintId" | "kind" | "targetLanguage">,
): boolean {
  return goal.kind === "exam" && goal.targetLanguage !== null && goal.examBlueprintId === null;
}

/**
 * What placement's first questions still wait for while research reads the exam's notice (see
 * `placementItemsWorkflow`): a language certificate's blueprint (`awaitsExamBlueprint`), until it's
 * linked or research ends without one; another exam's formats, until its blueprint is linked or a
 * first pass over the notice found them; null once they can be written. A workflow bridge for the
 * goal the run works for.
 */
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
