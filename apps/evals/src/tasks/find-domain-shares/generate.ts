import { type Reasoning } from "@zoonk/ai/provider-options";
import {
  type DomainShareFinding,
  findDomainShares,
} from "@zoonk/ai/tasks/research/find-domain-shares";
import { type BlueprintContent } from "@zoonk/core/library/exams/blueprint-contract";
import { applyDomainShares } from "@zoonk/core/library/exams/domain-shares";
import { type EvalDocument, loadDocument } from "../extract-exam-blueprint/generate";

/** A subject and its headings as the exam's reading found them. */
export type ShareSubject = { headings: string[]; name: string; questions: number | null };

export type DomainSharesEvalInput = {
  documents: EvalDocument[];
  exam: string;
  language: string;
  subjects: ShareSubject[];
};

/** `shares` is what production keeps: each subject's headings with the share code accepted, or null. */
export type DomainSharesEvalOutput = {
  findings: DomainShareFinding[];
  shares: Record<string, Record<string, number | null>>;
};

function toContent(subjects: readonly ShareSubject[]): BlueprintContent {
  return {
    edition: {
      check: null,
      citations: [],
      dates: [],
      noticeUrl: null,
      questionCount: null,
      sourceHash: "eval",
      timeZone: null,
      year: null,
    },
    structure: {
      formats: [],
      mock: null,
      rules: [],
      subjects: subjects.map((subject) => ({
        citation: { passage: subject.name, sourceId: "document-1" },
        name: subject.name,
        questions: subject.questions,
        topicGroups: subject.headings.map((name) => ({ name, topics: [] })),
        topics: [],
        weight: null,
      })),
    },
    topicFrequency: [],
  };
}

export async function generateDomainShares(
  input: DomainSharesEvalInput & { model: string; reasoning?: Reasoning },
) {
  const documents = await Promise.all(input.documents.map((document) => loadDocument(document)));

  const result = await findDomainShares({
    documents,
    exam: input.exam,
    model: input.model,
    reasoning: input.reasoning,
    subjects: input.subjects,
    useFallback: false,
  });

  const kept = applyDomainShares({
    content: toContent(input.subjects),
    documents: documents.map((document, index) => ({
      sourceId: `document-${index + 1}`,
      text: document.text,
    })),
    findings: result.data,
  });

  const shares = Object.fromEntries(
    kept.structure.subjects.map((subject) => [
      subject.name,
      Object.fromEntries(
        (subject.topicGroups ?? []).map((group) => [group.name, group.share ?? null]),
      ),
    ]),
  );

  const data: DomainSharesEvalOutput = { findings: result.data, shares };
  return { ...result, data };
}
