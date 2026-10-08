import "server-only";
import { type ExamBlueprint, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getExamBlueprintCacheTag } from "../../cache/tags";
import { type ExamStructure, examEditionSchema, examStructureSchema } from "./blueprint-contract";
import { needsPastQuestions } from "./subject-questions";

/** What research needs to look up a blueprint's subject counts, when it needs them. */
export type SubjectQuestionsLookup = {
  board: string | null;
  exam: string;
  subjects: string[];
  total: number | null;
};

function describeExam(blueprint: Pick<ExamBlueprint, "name" | "role">): string {
  return blueprint.role ? `${blueprint.name}, ${blueprint.role}` : blueprint.name;
}

/**
 * The lookup a shared blueprint needs for its subjects' counts (see `needsPastQuestions`), or null
 * when it needs none.
 *
 * This is a workflow bridge: the blueprint comes from the research run that linked it.
 */
export async function findSubjectQuestionsLookup({
  examBlueprintId,
  now = new Date(),
}: {
  examBlueprintId: string;
  now?: Date;
}): Promise<SubjectQuestionsLookup | null> {
  const blueprint = await prisma.examBlueprint.findUnique({ where: { id: examBlueprintId } });
  const structure = examStructureSchema.safeParse(blueprint?.structure).data;

  if (!blueprint || blueprint.ownerId || !structure || !needsPastQuestions({ now, structure })) {
    return null;
  }

  return {
    board: blueprint.board,
    exam: describeExam(blueprint),
    subjects: structure.subjects.map((subject) => subject.name),
    total:
      structure.mock?.totalQuestions ??
      examEditionSchema.safeParse(blueprint.edition).data?.questionCount ??
      null,
  };
}

/**
 * Stores what the lookup found for the subjects it was given (in their order), or that it found
 * nothing, on the blueprint's structure; the subjects' shares, the plan's weights and the screens
 * read it from there.
 *
 * This is a workflow bridge: the blueprint comes from the research run that looked it up.
 */
export async function recordSubjectQuestions({
  edition,
  examBlueprintId,
  now = new Date(),
  questions,
  source,
  subjects,
}: {
  edition: string | null;
  examBlueprintId: string;
  now?: Date;
  /** One count per subject, in the order of `subjects`; empty when nothing was found. */
  questions: readonly number[];
  source: { title: string | null; url: string } | null;
  subjects: readonly string[];
}): Promise<void> {
  const blueprint = await prisma.examBlueprint.findUnique({ where: { id: examBlueprintId } });
  const structure = examStructureSchema.safeParse(blueprint?.structure).data;

  if (!blueprint || !structure) {
    return;
  }

  const counted = subjects.flatMap((name, index) => {
    const count = questions[index];
    return count === undefined ? [] : [{ name, questions: count }];
  });

  const pastQuestions: NonNullable<ExamStructure["pastQuestions"]> = {
    checkedAt: now.toISOString(),
    edition: counted.length > 0 ? edition : null,
    source: counted.length > 0 ? source : null,
    subjects: counted,
  };

  // One statement sets only this lookup, so the options looked up at the same time
  // (`recordChoiceOptions`) are never overwritten.
  await prisma.$executeRaw`
    UPDATE exam_blueprints
    SET structure = jsonb_set(structure, '{pastQuestions}', ${JSON.stringify(pastQuestions)}::jsonb),
      updated_at = ${now}
    WHERE id = ${examBlueprintId}::uuid
  `;

  revalidateCacheTags([getExamBlueprintCacheTag(examBlueprintId)]);
}
