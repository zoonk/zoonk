import "server-only";
import { type ExamBlueprint, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getExamBlueprintCacheTag } from "../../cache/tags";
import { lockPlanBlueprintWrite, writePlanInputs } from "../_utils/plan-input-write";
import { type ExamStructure, examEditionSchema, examStructureSchema } from "./blueprint-contract";
import { needsPastQuestions } from "./subject-questions";

export type SubjectQuestionsLookup = {
  board: string | null;
  exam: string;
  subjects: string[];
  total: number | null;
};

function describeExam(blueprint: Pick<ExamBlueprint, "name" | "role">): string {
  return blueprint.role ? `${blueprint.name}, ${blueprint.role}` : blueprint.name;
}

/** Internal workflow bridge: the blueprint must come from the research run that linked it. */
export async function findSubjectQuestionsLookup({
  examBlueprintId,
}: {
  examBlueprintId: string;
}): Promise<SubjectQuestionsLookup | null> {
  const blueprint = await prisma.examBlueprint.findUnique({ where: { id: examBlueprintId } });
  const structure = examStructureSchema.safeParse(blueprint?.structure).data;

  if (
    !blueprint ||
    blueprint.ownerId ||
    !structure ||
    !needsPastQuestions({ now: new Date(), structure })
  ) {
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

/** Internal workflow bridge: the blueprint must come from the research run that requested the lookup. */
export async function recordSubjectQuestions({
  edition,
  examBlueprintId,
  questions,
  source,
  subjects,
}: {
  edition: string | null;
  examBlueprintId: string;
  questions: readonly (number | null)[];
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
    return count === undefined || count === null ? [] : [{ name, questions: count }];
  });

  const now = new Date();

  const pastQuestions: NonNullable<ExamStructure["pastQuestions"]> = {
    checkedAt: now.toISOString(),
    edition: counted.length > 0 ? edition : null,
    source: counted.length > 0 ? source : null,
    subjects: counted,
  };

  await writePlanInputs(async (tx) => {
    await lockPlanBlueprintWrite(tx, examBlueprintId);

    await tx.$executeRaw`
      UPDATE exam_blueprints
      SET structure = jsonb_set(structure, '{pastQuestions}', ${JSON.stringify(pastQuestions)}::jsonb),
        updated_at = ${now}
      WHERE id = ${examBlueprintId}::uuid
    `;
  });

  revalidateCacheTags([getExamBlueprintCacheTag(examBlueprintId)]);
}
