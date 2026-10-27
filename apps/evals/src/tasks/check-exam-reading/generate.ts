import { type Reasoning } from "@zoonk/ai/provider-options";
import {
  type ExamReadingFindings,
  type ReadSubject,
  checkExamReading,
} from "@zoonk/ai/tasks/v2/research/check-exam-reading";
import {
  type BlueprintContent,
  type ReadingProblem,
} from "@zoonk/core/library/exams/blueprint-contract";
import { findReadingProblems } from "@zoonk/core/library/exams/reading-check";
import { type EvalDocument, loadDocument } from "../extract-exam-blueprint/generate";

export type CheckReadingEvalInput = {
  documents: EvalDocument[];
  exam: string;
  /** The reading's subjects, as research gives them to the check. */
  subjects: ReadSubject[];
  total: number | null;
};

/** The model's findings, and the problems research keeps from them once code checked each one. */
export type CheckReadingEvalOutput = ExamReadingFindings & { problems: ReadingProblem[] };

/** A stored reading with only what the problems are found against: its subjects and total. */
function toContent({ subjects, total }: CheckReadingEvalInput): BlueprintContent {
  return {
    edition: {
      check: null,
      citations: [],
      dates: [],
      noticeUrl: null,
      questionCount: total,
      sourceHash: null,
      timeZone: null,
      year: null,
    },
    structure: {
      formats: [],
      mock: null,
      rules: [],
      subjects: subjects.map((subject) => ({
        citation: { passage: subject.name, sourceId: "document-1" },
        group: null,
        name: subject.name,
        questions: subject.questions,
        shortName: null,
        topics: [],
        weight: null,
      })),
    },
    topicFrequency: [],
  };
}

export async function generateReadingCheck(
  input: CheckReadingEvalInput & { model: string; reasoning?: Reasoning; useFallback?: boolean },
) {
  const documents = await Promise.all(input.documents.map((document) => loadDocument(document)));

  const result = await checkExamReading({
    documents,
    exam: input.exam,
    model: input.model,
    reasoning: input.reasoning,
    subjects: input.subjects,
    total: input.total,
    useFallback: false,
  });

  const problems = findReadingProblems({
    checked: input.subjects,
    content: toContent(input),
    documents: documents.map((document, index) => ({
      sourceId: `document-${index + 1}`,
      text: document.text,
    })),
    findings: result.data,
  });

  return { ...result, data: { ...result.data, problems } };
}
