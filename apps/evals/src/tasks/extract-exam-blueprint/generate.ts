import { type ModelCall } from "@/lib/types";
import { type Reasoning } from "@zoonk/ai/provider-options";
import { checkCitedFacts } from "@zoonk/ai/tasks/v2/research/check-cited-facts";
import { checkExamReading } from "@zoonk/ai/tasks/v2/research/check-exam-reading";
import { type ResearchDocument } from "@zoonk/ai/tasks/v2/research/documents";
import {
  type BlueprintExtraction,
  extractExamBlueprint,
} from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint";
import { toBlueprintContent } from "@zoonk/core/library/exams/blueprint-content";
import {
  type BlueprintContent,
  type ReadingProblem,
} from "@zoonk/core/library/exams/blueprint-contract";
import {
  listBlueprintFacts,
  toCheckBatches,
  toCitedFacts,
} from "@zoonk/core/library/exams/blueprint-facts";
import { listExtractionPassages } from "@zoonk/core/library/exams/blueprint-passages";
import { isPassageInDocument } from "@zoonk/core/library/exams/passage-check";
import { findReadingProblems, toReadingCorrections } from "@zoonk/core/library/exams/reading-check";
import { fetchDocument } from "@zoonk/core/library/sources/fetch";
import { parseDocument } from "@zoonk/core/library/sources/parse-document";

export type EvalDocument = { title: string; url: string } | { text: string; title: string };

export type ExtractionEvalInput = {
  exam: string;
  documents: EvalDocument[];
  leftOut?: ReadingProblem[];
};

export type ExtractionEvalOutput = BlueprintExtraction & {
  reading: { problems: ReadingProblem[] };
  passageCheck: { found: number; total: number };
  kept: BlueprintContent;
  check: { claims: number; inputTokens: number; kept: number; outputTokens: number };
};

export async function loadDocument(document: EvalDocument): Promise<ResearchDocument> {
  if ("text" in document) {
    return { file: null, images: [], text: document.text, title: document.title, url: null };
  }

  const { title, url } = document;
  const fetched = await fetchDocument(url);
  const parsed = await parseDocument({ bytes: fetched.bytes, contentType: fetched.contentType });
  const isPdf = fetched.contentType === "application/pdf";

  return {
    file: isPdf ? { data: fetched.bytes, mediaType: fetched.contentType } : null,
    images: parsed.images,
    text: parsed.text,
    title,
    url: fetched.url,
  };
}

function checkPassages({
  documents,
  extraction,
}: {
  documents: ResearchDocument[];
  extraction: BlueprintExtraction;
}) {
  const passages = listExtractionPassages(extraction);

  const found = passages.filter((item) => {
    const text = documents[item.document - 1]?.text;
    return text ? isPassageInDocument({ passage: item.passage, text }) : false;
  });

  return { found: found.length, total: passages.length };
}

type EvalDocumentSource = { sourceId: string; text: string | null };

type CallProvenance = {
  model: string;
  usage: {
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    inputTokens?: number;
    outputTokens?: number;
    reasoningTokens?: number;
  };
};

function toModelCall({ model, usage }: CallProvenance): ModelCall {
  return {
    modelId: model,
    usage: {
      cacheReadTokens: usage.cacheReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      reasoningTokens: usage.reasoningTokens,
    },
  };
}

function toSources(documents: ResearchDocument[]): EvalDocumentSource[] {
  return documents.map((document, index) => ({
    sourceId: `document-${index + 1}`,
    text: document.text,
  }));
}

async function keepCheckedFacts({
  documents,
  extraction,
}: {
  documents: ResearchDocument[];
  extraction: BlueprintExtraction;
}): Promise<Pick<ExtractionEvalOutput, "check" | "kept"> & { calls: ModelCall[] }> {
  const extractionDocuments = toSources(documents);
  const facts = listBlueprintFacts({ documents: extractionDocuments, extraction });

  const checks = await Promise.all(
    toCheckBatches(toCitedFacts(facts)).map((batch) => checkCitedFacts({ facts: batch })),
  );

  const supportedIds = checks.flatMap((check) => check.data.supportedIds);

  return {
    calls: checks.map((check) => toModelCall(check.provenance)),
    check: {
      claims: facts.length,
      inputTokens: checks.reduce((total, check) => total + (check.usage.inputTokens ?? 0), 0),
      kept: supportedIds.length,
      outputTokens: checks.reduce((total, check) => total + (check.usage.outputTokens ?? 0), 0),
    },
    kept: toBlueprintContent({
      documents: extractionDocuments,
      extraction,
      facts,
      noticeUrl: null,
      sourceHash: "eval",
      supportedIds,
    }),
  };
}

async function readChecked({
  corrections,
  documents,
  input,
}: {
  corrections: ReadingProblem[];
  documents: ResearchDocument[];
  input: ExtractionEvalInput & { model: string; reasoning?: Reasoning };
}) {
  const result = await extractExamBlueprint({
    corrections: corrections.flatMap((problem) =>
      toReadingCorrections({ documents: toSources(documents), problem }),
    ),
    documents,
    exam: input.exam,
    model: input.model,
    reasoning: input.reasoning,
    useFallback: false,
  });

  const checked = result.data;

  const [kept, findings] = await Promise.all([
    keepCheckedFacts({ documents, extraction: checked }),
    checkExamReading({
      documents,
      exam: input.exam,
      subjects: checked.subjects.map((subject) => ({
        name: subject.name,
        questions: subject.questions,
      })),
      total: checked.mock?.totalQuestions ?? checked.edition.questionCount,
    }),
  ]);

  const problems = findReadingProblems({
    checked: checked.subjects,
    content: kept.kept,
    documents: toSources(documents),
    findings: findings.data,
    read: checked,
  });

  const calls = [
    ...kept.calls,
    toModelCall(findings.provenance),
    ...(result.formatsProvenance ? [toModelCall(result.formatsProvenance)] : []),
  ];

  return { ...kept, calls, problems, result };
}

export async function generateExtraction(
  input: ExtractionEvalInput & { model: string; reasoning?: Reasoning; useFallback?: boolean },
) {
  const documents = await Promise.all(input.documents.map((document) => loadDocument(document)));

  const { calls, check, kept, problems, result } = await readChecked({
    corrections: input.leftOut ?? [],
    documents,
    input,
  });

  return {
    ...result,
    data: {
      ...result.data,
      check,
      kept,
      passageCheck: checkPassages({ documents, extraction: result.data }),
      reading: { problems },
    },
    extraCalls: calls,
  };
}
