import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { checkCitedFacts } from "@zoonk/ai/tasks/research/check-cited-facts";
import { checkExamReading } from "@zoonk/ai/tasks/research/check-exam-reading";
import { listExamParts } from "@zoonk/ai/tasks/research/exam-parts";
import {
  type BlueprintExtraction,
  extractExamBlueprint,
} from "@zoonk/ai/tasks/research/extract-exam-blueprint";
import {
  applyQuestionFormats,
  extractQuestionFormats,
} from "@zoonk/ai/tasks/research/extract-question-formats";
import { translatePassMarks } from "@zoonk/ai/tasks/research/translate-pass-marks";
import {
  isUsableBlueprint,
  toBlueprintContent,
  toReusePolicy,
} from "@zoonk/core/library/exams/blueprint-content";
import {
  type BlueprintContent,
  type ReadingProblem,
} from "@zoonk/core/library/exams/blueprint-contract";
import {
  listBlueprintFacts,
  toCheckBatches,
  toCitedFacts,
} from "@zoonk/core/library/exams/blueprint-facts";
import { toMaterialContent } from "@zoonk/core/library/exams/material-topics";
import { listPassMarkTexts, withPassMarkTranslations } from "@zoonk/core/library/exams/pass-marks";
import { findReadingProblems, toReadingCorrections } from "@zoonk/core/library/exams/reading-check";
import { type ReusePolicy } from "@zoonk/core/library/sources/contract";
import { loadSourceDocuments } from "@zoonk/core/library/sources/load-documents";
import { safeAsync } from "@zoonk/utils/error";
import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { logError } from "@zoonk/utils/logger";
import { FatalError } from "workflow";
import { type ResearchAnalytics } from "../_utils/research-analytics";

export type BlueprintReading = {
  content: BlueprintContent;
  facts: { extracted: number; kept: number };
  problems: ReadingProblem[] | null;
  provenance: { generatedAt: string; model: string; promptVersion: string; runId: string };
  reusePolicy: { policy: ReusePolicy; sourceId: string } | null;
  usable: boolean;
};

type BlueprintTextDocument = Pick<
  Awaited<ReturnType<typeof loadSourceDocuments>>[number],
  "contentHash" | "id" | "text" | "url"
>;

function toReadSubjects(extraction: BlueprintExtraction) {
  return extraction.subjects.map((subject) => ({
    name: subject.name,
    questions: subject.questions,
  }));
}

async function checkReading({
  analytics,
  sourceIds,
  exam,
  extraction,
  serviceTier,
}: {
  analytics: ResearchAnalytics;
  sourceIds: string[];
  exam: string;
  extraction: BlueprintExtraction;
  serviceTier: ReturnType<typeof chooseServiceTier>;
}) {
  "use step";

  const { data, error } = await safeAsync(async () => {
    const documents = await loadSourceDocuments(sourceIds);

    return checkExamReading({
      analytics,
      documents,
      exam,
      serviceTier,
      subjects: toReadSubjects(extraction),
      total: extraction.mock?.totalQuestions ?? extraction.edition.questionCount,
    });
  });

  if (error) {
    logError(`The reading of "${exam}" couldn't be checked:`, error);
  }

  return data?.data ?? null;
}

async function translateReadPassMarks({
  analytics,
  exam,
  extraction,
  serviceTier,
}: {
  analytics: ResearchAnalytics;
  exam: string;
  extraction: BlueprintExtraction;
  serviceTier: ReturnType<typeof chooseServiceTier>;
}) {
  "use step";

  const texts = listPassMarkTexts(extraction.rules);

  if (texts.length === 0) {
    return { texts, translations: {} };
  }

  const { data, error } = await safeAsync(() =>
    translatePassMarks({ analytics, languages: SUPPORTED_LOCALES, serviceTier, texts }),
  );

  if (error) {
    logError(`The pass marks of "${exam}" couldn't be translated:`, error);
  }

  return { texts, translations: data?.data.translations ?? {} };
}

type ExtractInput = {
  analytics: ResearchAnalytics;
  background: boolean;
  corrections?: ReadingProblem[];
  exam: string;
  shared: boolean;
  sourceIds: string[];
};

async function extractBlueprintDraftStep({
  analytics,
  background,
  corrections = [],
  exam,
  sourceIds,
}: ExtractInput) {
  "use step";
  const documents = await loadSourceDocuments(sourceIds);
  const [notice] = documents;

  if (!notice) {
    throw new FatalError("None of the research sources exist anymore.");
  }

  const serviceTier = chooseServiceTier({
    reuse: documents.every((document) => document.url) ? "bounded" : "personal",
    wait: background ? "later" : "learner",
  });

  const extractionDocuments = documents.map((document) => ({
    sourceId: document.id,
    text: document.text,
  }));

  const extraction = await extractExamBlueprint({
    analytics,
    corrections: corrections.flatMap((problem) =>
      toReadingCorrections({ documents: extractionDocuments, problem }),
    ),
    documents,
    exam,
    readFormats: false,
    serviceTier,
  });

  return {
    documents: documents.map(({ contentHash, id, text, url }) => ({ contentHash, id, text, url })),
    extraction,
    serviceTier,
  };
}

async function readBlueprintFormatsStep({
  extraction,
  sourceIds,
  ...input
}: Omit<Parameters<typeof extractQuestionFormats>[0], "documents" | "parts"> & {
  sourceIds: string[];
  extraction: BlueprintExtraction;
}) {
  "use step";
  const documents = await loadSourceDocuments(sourceIds);

  const { data } = await extractQuestionFormats({
    ...input,
    documents,
    parts: listExamParts(extraction),
  });

  return applyQuestionFormats({ extraction, found: data });
}

async function prepareBlueprintChecksStep({
  documents,
  extraction,
}: {
  documents: BlueprintTextDocument[];
  extraction: BlueprintExtraction;
}) {
  "use step";

  const facts = listBlueprintFacts({
    documents: documents.map((document) => ({ sourceId: document.id, text: document.text })),
    extraction,
  });

  return { batches: toCheckBatches(toCitedFacts(facts)), facts };
}

async function checkCitedFactsStep(input: Parameters<typeof checkCitedFacts>[0]) {
  "use step";
  return checkCitedFacts(input);
}

/** The first document is the notice whose hash the blueprint records. */
export async function extractBlueprint({
  analytics,
  background,
  corrections = [],
  exam,
  shared,
  sourceIds,
}: ExtractInput): Promise<BlueprintReading> {
  const {
    documents,
    extraction: draft,
    serviceTier,
  } = await extractBlueprintDraftStep({
    analytics,
    background,
    corrections,
    exam,
    shared,
    sourceIds,
  });

  const extraction = await readBlueprintFormatsStep({
    analytics,
    exam,
    extraction: draft.data,
    serviceTier,
    sourceIds,
  }).catch(() => draft.data);

  const { batches, facts } = await prepareBlueprintChecksStep({ documents, extraction });

  const [checks, findings, passMarks] = await Promise.all([
    Promise.all(
      batches.map((batch) => checkCitedFactsStep({ analytics, facts: batch, serviceTier })),
    ),
    shared ? checkReading({ analytics, exam, extraction, serviceTier, sourceIds }) : null,
    translateReadPassMarks({ analytics, exam, extraction, serviceTier }),
  ]);

  return assembleBlueprintStep({
    checks,
    documents,
    extraction,
    facts,
    findings,
    passMarks,
    provenance: draft.provenance,
    shared,
  });
}

async function assembleBlueprintStep({
  checks,
  documents,
  extraction,
  facts,
  findings,
  passMarks,
  provenance,
  shared,
}: {
  checks: Awaited<ReturnType<typeof checkCitedFacts>>[];
  documents: BlueprintTextDocument[];
  extraction: BlueprintExtraction;
  facts: ReturnType<typeof listBlueprintFacts>;
  findings: Awaited<ReturnType<typeof checkReading>>;
  passMarks: Awaited<ReturnType<typeof translateReadPassMarks>>;
  provenance: Awaited<ReturnType<typeof extractExamBlueprint>>["provenance"];
  shared: boolean;
}): Promise<BlueprintReading> {
  "use step";
  const { generatedAt, model, promptVersion, runId } = provenance;
  const [notice] = documents;

  if (!notice) {
    throw new FatalError("None of the research sources exist anymore.");
  }

  const extractionDocuments = documents.map((document) => ({
    sourceId: document.id,
    text: document.text,
  }));

  const supportedIds = checks.flatMap((check) => check.data.supportedIds);

  const checked = toBlueprintContent({
    documents: extractionDocuments,
    extraction,
    facts,
    noticeUrl: notice.url,
    sourceHash: notice.contentHash,
    supportedIds,
  });

  const read = {
    ...checked,
    structure: withPassMarkTranslations({ structure: checked.structure, ...passMarks }),
  };

  const content = shared
    ? read
    : toMaterialContent({ content: read, documents: extractionDocuments });

  return {
    content,
    facts: { extracted: facts.length, kept: supportedIds.length },
    problems: findings
      ? findReadingProblems({
          checked: toReadSubjects(extraction),
          content,
          documents: extractionDocuments,
          findings,
          read: extraction,
        })
      : null,
    provenance: { generatedAt, model, promptVersion, runId },
    reusePolicy: toReusePolicy({ extraction, facts, supportedIds }),
    usable: isUsableBlueprint({ content, shared }),
  };
}
