import { type Reasoning } from "@zoonk/ai/provider-options";
import { checkCitedFacts } from "@zoonk/ai/tasks/v2/research/check-cited-facts";
import { type ResearchDocument } from "@zoonk/ai/tasks/v2/research/documents";
import {
  type BlueprintExtraction,
  extractExamBlueprint,
} from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint";
import { toBlueprintContent } from "@zoonk/core/library/exams/blueprint-content";
import { type BlueprintContent } from "@zoonk/core/library/exams/blueprint-contract";
import {
  listBlueprintFacts,
  toCheckBatches,
  toCitedFacts,
} from "@zoonk/core/library/exams/blueprint-facts";
import { listExtractionPassages } from "@zoonk/core/library/exams/blueprint-passages";
import { isPassageInDocument } from "@zoonk/core/library/exams/passage-check";
import { fetchDocument } from "@zoonk/core/library/sources/fetch";
import { parseDocument } from "@zoonk/core/library/sources/parse-document";

export type ExtractionEvalInput = {
  exam: string;
  /** Real notices, fetched when the eval runs, as research would fetch them. */
  documents: { title: string; url: string }[];
};

export type ExtractionEvalOutput = BlueprintExtraction & {
  /** How many quoted passages code found in their document, the first half of the citation check. */
  passageCheck: { found: number; total: number };
  /** What research stores after both checks: the facts learners plan with. */
  kept: BlueprintContent;
  /** The model check's claims and cost, which the eval's spend doesn't count. */
  check: { claims: number; inputTokens: number; kept: number; outputTokens: number };
};

async function loadDocument({
  title,
  url,
}: {
  title: string;
  url: string;
}): Promise<ResearchDocument> {
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

/** Both citation checks, as research runs them, with the production check model. */
async function keepCheckedFacts({
  documents,
  extraction,
}: {
  documents: ResearchDocument[];
  extraction: BlueprintExtraction;
}): Promise<Pick<ExtractionEvalOutput, "check" | "kept">> {
  const extractionDocuments = documents.map((document, index) => ({
    sourceId: `document-${index + 1}`,
    text: document.text,
  }));

  const facts = listBlueprintFacts({ documents: extractionDocuments, extraction });

  const checks = await Promise.all(
    toCheckBatches(toCitedFacts(facts)).map((batch) => checkCitedFacts({ facts: batch })),
  );

  const supportedIds = checks.flatMap((check) => check.data.supportedIds);

  return {
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

export async function generateExtraction(
  input: ExtractionEvalInput & { model: string; reasoning?: Reasoning; useFallback?: boolean },
) {
  const documents = await Promise.all(input.documents.map((document) => loadDocument(document)));

  const result = await extractExamBlueprint({
    documents,
    exam: input.exam,
    model: input.model,
    reasoning: input.reasoning,
    useFallback: false,
  });

  return {
    ...result,
    data: {
      ...result.data,
      ...(await keepCheckedFacts({ documents, extraction: result.data })),
      passageCheck: checkPassages({ documents, extraction: result.data }),
    },
  };
}
