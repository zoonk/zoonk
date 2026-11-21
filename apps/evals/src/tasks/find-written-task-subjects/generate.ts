import { type Reasoning } from "@zoonk/ai/provider-options";
import {
  type WrittenTaskInput,
  type WrittenTaskSubjects,
  findWrittenTaskSubjects,
} from "@zoonk/ai/tasks/research/find-written-task-subjects";
import { isPassageInDocument } from "@zoonk/core/library/exams/passage-check";
import { type EvalDocument, loadDocument } from "../extract-exam-blueprint/generate";

export type EvalSubject = { choiceGroup?: string; group?: string; name: string };

/** `subjects` and `tasks` as the exam's reading found them. */
export type TaskSubjectsEvalInput = {
  documents: EvalDocument[];
  exam: string;
  subjects: EvalSubject[];
  tasks: WrittenTaskInput[];
};

export type TaskSubjectsEvalOutput = {
  links: WrittenTaskSubjects[];
  passageCheck: { found: number; total: number };
};

export async function generateTaskSubjects(
  input: TaskSubjectsEvalInput & { model: string; reasoning?: Reasoning },
) {
  const documents = await Promise.all(input.documents.map((document) => loadDocument(document)));

  const names = [
    ...new Set(
      input.subjects.flatMap(({ choiceGroup, group, name }) =>
        [name, group, choiceGroup].filter((value): value is string => Boolean(value)),
      ),
    ),
  ];

  const result = await findWrittenTaskSubjects({
    documents,
    exam: input.exam,
    model: input.model,
    names,
    reasoning: input.reasoning,
    tasks: input.tasks,
    useFallback: false,
  });

  if (!result) {
    throw new Error("A case needs written tasks and subjects to ask about.");
  }

  const links = result.data;

  const found = links.filter((link) => {
    const text = documents[link.document - 1]?.text;
    return text ? isPassageInDocument({ passage: link.passage, text }) : false;
  });

  const data: TaskSubjectsEvalOutput = {
    links,
    passageCheck: { found: found.length, total: links.length },
  };

  return { ...result, data };
}
