import { type Reasoning } from "@zoonk/ai/provider-options";
import {
  type QuestionFormat,
  extractQuestionFormats,
} from "@zoonk/ai/tasks/research/extract-question-formats";
import { isPassageInDocument } from "@zoonk/core/library/exams/passage-check";
import { type EvalDocument, loadDocument } from "../extract-exam-blueprint/generate";

/** `parts`: the exam's parts as its blueprint reading named them; none for class notes. */
export type FormatsEvalInput = { documents: EvalDocument[]; exam: string; parts?: string[] };

export type FormatsEvalOutput = {
  formats: QuestionFormat[];
  passageCheck: { found: number; total: number };
};

export async function generateQuestionFormats(
  input: FormatsEvalInput & { model: string; reasoning?: Reasoning },
) {
  const documents = await Promise.all(input.documents.map((document) => loadDocument(document)));

  const result = await extractQuestionFormats({
    documents,
    exam: input.exam,
    model: input.model,
    parts: input.parts,
    reasoning: input.reasoning,
    useFallback: false,
  });

  const found = result.data.filter((format) => {
    const text = documents[format.document - 1]?.text;
    return text ? isPassageInDocument({ passage: format.passage, text }) : false;
  });

  const data: FormatsEvalOutput = {
    formats: result.data,
    passageCheck: { found: found.length, total: result.data.length },
  };

  return { ...result, data };
}
