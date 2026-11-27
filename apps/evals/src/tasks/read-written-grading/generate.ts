import { type Reasoning } from "@zoonk/ai/provider-options";
import {
  type WrittenGradingInput,
  type WrittenTaskGrading,
  readWrittenGrading,
} from "@zoonk/ai/tasks/research/read-written-grading";
import { isPassageInDocument } from "@zoonk/core/library/exams/passage-check";
import { type EvalDocument, loadDocument } from "../extract-exam-blueprint/generate";

export type WrittenGradingEvalInput = {
  documents: EvalDocument[];
  exam: string;
  tasks: WrittenGradingInput[];
};

type Passage = { document: number; passage: string };

/** Each task's rules whose passage isn't in the document it names; production drops them and the task's total. */
export type WrittenGradingEvalOutput = {
  tasks: (WrittenTaskGrading & { passages: { missing: string[]; total: number } })[];
};

function listPassages({ grading }: WrittenTaskGrading): Passage[] {
  return [
    ...grading.criteria.flatMap((criterion) => [
      criterion,
      ...criterion.awards,
      ...criterion.parts,
    ]),
    ...(grading.combination ? [grading.combination] : []),
    ...grading.conventions,
    ...grading.deductions,
    ...(grading.language ? [grading.language] : []),
    ...grading.limits,
    ...(grading.rounding ? [grading.rounding] : []),
    ...grading.zeroing,
  ];
}

export async function generateWrittenGrading(
  input: WrittenGradingEvalInput & { model: string; reasoning?: Reasoning; useFallback?: boolean },
) {
  const documents = await Promise.all(input.documents.map((document) => loadDocument(document)));

  const result = await readWrittenGrading({
    documents,
    exam: input.exam,
    model: input.model,
    reasoning: input.reasoning,
    tasks: input.tasks,
    useFallback: false,
  });

  if (!result) {
    throw new Error("A case needs written tasks to ask about.");
  }

  const tasks = result.data.map((task) => {
    const passages = listPassages(task);

    const missing = passages.filter(({ document, passage }) => {
      const text = documents[document - 1]?.text;
      return !text || !isPassageInDocument({ passage, text });
    });

    return {
      ...task,
      passages: { missing: missing.map(({ passage }) => passage), total: passages.length },
    };
  });

  const data: WrittenGradingEvalOutput = { tasks };
  return { ...result, data };
}
