import "server-only";
import { type QuestionFormat } from "@zoonk/ai/tasks/v2/research/extract-question-formats";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type ExamStructure, examStructureSchema } from "./blueprint-contract";
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

  // Merged in place: onboarding writes the learner's answers into the same details meanwhile.
  await prisma.$executeRaw`
    UPDATE goals
    SET details = jsonb_set(details, '{noticeFormats}', ${JSON.stringify(cited)}::jsonb)
    WHERE id = ${goalId}::uuid
  `;
}

/**
 * Whether a goal knows how its exam asks questions: its notice's blueprint is linked, or a first
 * pass over the notice research is reading found its formats. Placement's first questions wait
 * for it (see `placementItemsWorkflow`). A workflow bridge for the goal the run works for.
 */
export async function hasGoalExamFormat(goalId: string): Promise<boolean> {
  const goal = await prisma.goal.findUnique({
    select: { details: true, examBlueprintId: true },
    where: { id: goalId },
  });

  return Boolean(goal && (goal.examBlueprintId || readNoticeFormats(goal.details)));
}
