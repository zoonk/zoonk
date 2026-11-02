import { type ExamStructure } from "../blueprint-contract";

type ExamFormat = ExamStructure["formats"][number];

export function examFormat(kind: ExamFormat["kind"]): ExamFormat {
  return {
    citation: { passage: `The exam has ${kind} questions.`, sourceId: "source" },
    description: `Questions in the ${kind} format.`,
    kind,
    options: null,
  };
}

export function examStructure(kinds: readonly ExamFormat["kind"][]) {
  return { formats: kinds.map((kind) => examFormat(kind)), mock: null, rules: [], subjects: [] };
}
