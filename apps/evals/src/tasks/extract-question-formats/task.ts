import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import { type OptionSelect } from "@zoonk/ai/tasks/items/schemas";
import { type QuestionFormat } from "@zoonk/ai/tasks/research/extract-question-formats";
import { normalizeString } from "@zoonk/utils/string";
import { type FormatsEvalInput, type FormatsEvalOutput, generateQuestionFormats } from "./generate";
import { TEST_CASES } from "./test-cases";

/** `section` is a word one of the format's `sections` holds. */
type FormatFact = {
  description?: RegExp;
  kind: QuestionFormat["kind"];
  options?: number;
  passage?: RegExp;
  section?: string;
  select?: OptionSelect | null;
};

export type FormatsExpected = { absent: FormatFact[]; present: FormatFact[] };

const MIN_SCORE = 2;
const SCORE_RANGE = 8;
const FACT_WEIGHT = 0.8;
const PASSAGE_WEIGHT = 0.2;

function namesSection({ format, section }: { format: QuestionFormat; section: string }): boolean {
  return format.sections.some((name) => normalizeString(name).includes(normalizeString(section)));
}

function matches({ fact, format }: { fact: FormatFact; format: QuestionFormat }): boolean {
  return (
    format.kind === fact.kind &&
    (fact.options === undefined || format.options === fact.options) &&
    (fact.select === undefined || format.select === fact.select) &&
    (!fact.passage || fact.passage.test(format.passage)) &&
    (!fact.description || fact.description.test(format.description)) &&
    (fact.section === undefined || namesSection({ format, section: fact.section }))
  );
}

function describeFact(fact: FormatFact): string {
  return JSON.stringify(fact, (_key, value: unknown) =>
    value instanceof RegExp ? value.source : value,
  );
}

function parseOutput(output: string): FormatsEvalOutput | null {
  try {
    return JSON.parse(output) as FormatsEvalOutput;
  } catch {
    return null;
  }
}

const scoreFormats: TaskScorer<FormatsExpected> = ({ output, testCase }) => {
  const parsed = parseOutput(output);
  const expected = testCase.expected;

  if (!parsed?.formats || !expected) {
    return createFixedScore({ conclusion: "Invalid output", score: MIN_SCORE });
  }

  const has = (fact: FormatFact) => parsed.formats.some((format) => matches({ fact, format }));
  const missing = expected.present.filter((fact) => !has(fact));
  const wrong = expected.absent.filter((fact) => has(fact));
  const facts = expected.present.length + expected.absent.length;
  const factShare = facts === 0 ? 1 : (facts - missing.length - wrong.length) / facts;
  const { found, total } = parsed.passageCheck;
  const passageShare = total === 0 ? 0 : found / total;

  const conclusion = [
    `Facts ${facts - missing.length - wrong.length}/${facts}`,
    `passages found ${found}/${total}`,
    missing.length > 0 ? `missing: ${missing.map((fact) => describeFact(fact)).join("; ")}` : "",
    wrong.length > 0 ? `wrong: ${wrong.map((fact) => describeFact(fact)).join("; ")}` : "",
  ]
    .filter(Boolean)
    .join(". ");

  return createFixedScore({
    conclusion,
    score: MIN_SCORE + SCORE_RANGE * (FACT_WEIGHT * factShare + PASSAGE_WEIGHT * passageShare),
  });
};

export const extractQuestionFormatsTask: Task<
  FormatsEvalInput,
  FormatsEvalOutput,
  FormatsExpected
> = {
  description:
    "List an exam's question formats from its documents, each tied to the sections that ask it and quoting its passage",
  generate: generateQuestionFormats,
  id: "extract-question-formats",
  name: "Extract Question Formats",
  score: scoreFormats,
  testCases: TEST_CASES,
};
