import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { checkCitedFacts } from "@zoonk/ai/tasks/research/check-cited-facts";
import { checkExamReading } from "@zoonk/ai/tasks/research/check-exam-reading";
import {
  type BlueprintExtraction,
  extractExamBlueprint,
} from "@zoonk/ai/tasks/research/extract-exam-blueprint";
import {
  type WrittenTaskGrading,
  applyWrittenGrading,
} from "@zoonk/ai/tasks/research/read-written-grading";
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
import { readBlueprintFormatsStep } from "./blueprint-formats-step";
import { readWrittenGradingStep } from "./written-grading-step";
import { readWrittenTaskSubjectsStep } from "./written-task-subjects-step";

export type BlueprintReading = {
  content: BlueprintContent;
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
    const documents = await loadSourceDocuments(sourceIds, { preferText: true });

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

  const serviceTier = chooseServiceTier({ wait: background ? "later" : "learner" });

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
    readFollowUps: false,
    serviceTier,
  });

  return {
    documents: documents.map(({ contentHash, id, text, url }) => ({ contentHash, id, text, url })),
    extraction,
    serviceTier,
  };
}

async function prepareBlueprintChecksStep({
  documents,
  gradings,
  reading,
  shared,
}: {
  documents: BlueprintTextDocument[];
  gradings: WrittenTaskGrading[];
  reading: BlueprintExtraction;
  shared: boolean;
}) {
  "use step";

  const extraction = applyWrittenGrading({ extraction: reading, found: gradings });

  const facts = listBlueprintFacts({
    documents: documents.map((document) => ({ sourceId: document.id, text: document.text })),
    extraction,
    material: !shared,
  });

  return { batches: toCheckBatches(toCitedFacts(facts)), extraction, facts };
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

  const reads = { analytics, exam, serviceTier, sourceIds };

  const withFormats = await readBlueprintFormatsStep({ ...reads, extraction: draft.data }).catch(
    () => draft.data,
  );

  const [withSubjects, gradings] = await Promise.all([
    readWrittenTaskSubjectsStep({ ...reads, extraction: withFormats }).catch(() => withFormats),
    readWrittenGradingStep({ ...reads, extraction: withFormats }).catch(() => []),
  ]);

  const { batches, extraction, facts } = await prepareBlueprintChecksStep({
    documents,
    gradings,
    reading: withSubjects,
    shared,
  });

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
