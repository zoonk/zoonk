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
import {
  findReadingProblems,
  pickBetterReading,
  toReadingCorrections,
} from "@zoonk/core/library/exams/reading-check";
import { fetchDocument } from "@zoonk/core/library/sources/fetch";
import { parseDocument } from "@zoonk/core/library/sources/parse-document";

/**
 * A real notice, fetched when the eval runs as research would fetch it, or a learner's material
 * given as its text, as an upload is read.
 */
export type EvalDocument = { title: string; url: string } | { text: string; title: string };

export type ExtractionEvalInput = {
  exam: string;
  documents: EvalDocument[];
  /** What a check found an earlier reading of the documents left out, for a reading again. */
  leftOut?: ReadingProblem[];
};

export type ExtractionEvalOutput = BlueprintExtraction & {
  /** What the check found the kept reading left out, and how many readings research made. */
  reading: { problems: ReadingProblem[]; readings: number };
  /** How many quoted passages code found in their document, the first half of the citation check. */
  passageCheck: { found: number; total: number };
  /** What research stores after both checks: the facts learners plan with. */
  kept: BlueprintContent;
  /** The model check's claims and cost, which the eval's spend doesn't count. */
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

/** What a call's provenance reports, for pricing it at the model that answered. */
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

/** Both citation checks, as research runs them, with the production check model. */
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

/**
 * One reading as research makes it: the extraction, then both citation checks beside the check
 * for what it left out (`checkExamReading`, with its production model).
 */
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

  // Every call besides the reading itself, which is what the eval measures.
  const calls = [
    ...kept.calls,
    toModelCall(findings.provenance),
    ...(result.formatsProvenance ? [toModelCall(result.formatsProvenance)] : []),
  ];

  return { ...kept, calls, problems, result };
}

/**
 * Research's reading of a shared exam's documents: read and checked, then read once more, told
 * what the check found, when it found something, keeping the reading with fewer problems. The
 * kept reading's extraction is what the eval measures; every other call, its checks and a reading
 * set aside included, counts in what it spent (`extraCalls`).
 */
export async function generateExtraction(
  input: ExtractionEvalInput & { model: string; reasoning?: Reasoning; useFallback?: boolean },
) {
  const documents = await Promise.all(input.documents.map((document) => loadDocument(document)));
  const first = await readChecked({ corrections: input.leftOut ?? [], documents, input });

  const second =
    first.problems.length > 0
      ? await readChecked({ corrections: first.problems, documents, input })
      : null;

  const reading = second ? pickBetterReading({ first, second }) : first;
  const setAside = second && (reading === first ? second : first);
  const { calls, check, kept, problems, result } = reading;

  const setAsideCalls = setAside
    ? [toModelCall(setAside.result.provenance), ...setAside.calls]
    : [];

  return {
    ...result,
    data: {
      ...result.data,
      check,
      kept,
      passageCheck: checkPassages({ documents, extraction: result.data }),
      reading: { problems, readings: reading === first ? 1 : 2 },
    },
    extraCalls: [...calls, ...setAsideCalls],
  };
}
