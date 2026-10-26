import { type ExamStructure } from "../blueprint-contract";

type ExamFormat = ExamStructure["formats"][number];

/** A question format as an exam's notice states it, quoting a line of its own. */
export function examFormat(kind: ExamFormat["kind"]): ExamFormat {
  return {
    citation: { passage: `The exam has ${kind} questions.`, sourceId: "source" },
    description: `Questions in the ${kind} format.`,
    kind,
    options: null,
  };
}

/** A blueprint's structure whose notice states only these question formats. */
export function examStructure(kinds: readonly ExamFormat["kind"][]) {
  return { formats: kinds.map((kind) => examFormat(kind)), mock: null, rules: [], subjects: [] };
}
