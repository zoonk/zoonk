import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { checkCitedFacts } from "@zoonk/ai/tasks/v2/research/check-cited-facts";
import { checkExamReading } from "@zoonk/ai/tasks/v2/research/check-exam-reading";
import {
  type BlueprintExtraction,
  extractExamBlueprint,
} from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint";
import { translatePassMarks } from "@zoonk/ai/tasks/v2/research/translate-pass-marks";
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
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchAnalytics } from "../_utils/research-analytics";

export type BlueprintReading = {
  content: BlueprintContent;
  facts: { extracted: number; kept: number };
  problems: ReadingProblem[] | null;
  provenance: { generatedAt: string; model: string; promptVersion: string; runId: string };
  reusePolicy: { policy: ReusePolicy; sourceId: string } | null;
  usable: boolean;
};

function toReadSubjects(extraction: BlueprintExtraction) {
  return extraction.subjects.map((subject) => ({
    name: subject.name,
    questions: subject.questions,
  }));
}

async function checkReading({
  analytics,
  documents,
  exam,
  extraction,
  serviceTier,
}: {
  analytics: ResearchAnalytics;
  documents: Awaited<ReturnType<typeof loadSourceDocuments>>;
  exam: string;
  extraction: BlueprintExtraction;
  serviceTier: ReturnType<typeof chooseServiceTier>;
}) {
  const { data, error } = await safeAsync(() =>
    checkExamReading({
      analytics,
      documents,
      exam,
      serviceTier,
      subjects: toReadSubjects(extraction),
      total: extraction.mock?.totalQuestions ?? extraction.edition.questionCount,
    }),
  );

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
  const texts = listPassMarkTexts(extraction.rules);

  if (texts.length === 0) {
    return { texts, translations: {} };
  }

  const { data, error } = await safeAsync(() =>
    withAiRetry(() =>
      translatePassMarks({ analytics, languages: SUPPORTED_LOCALES, serviceTier, texts }),
    ),
  );

  if (error) {
    logError(`The pass marks of "${exam}" couldn't be translated:`, error);
  }

  return { texts, translations: data?.data.translations ?? {} };
}

/** The first document is the notice whose hash the blueprint records. */
export async function extractBlueprintStep({
  analytics,
  background,
  corrections = [],
  exam,
  shared,
  sourceIds,
}: {
  analytics: ResearchAnalytics;
  background: boolean;
  corrections?: ReadingProblem[];
  exam: string;
  shared: boolean;
  sourceIds: string[];
}): Promise<BlueprintReading> {
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

  const extraction = await withAiRetry(() =>
    extractExamBlueprint({
      analytics,
      corrections: corrections.flatMap((problem) =>
        toReadingCorrections({ documents: extractionDocuments, problem }),
      ),
      documents,
      exam,
      serviceTier,
    }),
  );

  const facts = listBlueprintFacts({ documents: extractionDocuments, extraction: extraction.data });
  const citedFacts = toCitedFacts(facts);

  const [checks, findings, passMarks] = await Promise.all([
    Promise.all(
      toCheckBatches(citedFacts).map((batch) =>
        withAiRetry(() => checkCitedFacts({ analytics, facts: batch, serviceTier })),
      ),
    ),
    shared
      ? checkReading({ analytics, documents, exam, extraction: extraction.data, serviceTier })
      : null,
    translateReadPassMarks({ analytics, exam, extraction: extraction.data, serviceTier }),
  ]);

  const supportedIds = checks.flatMap((check) => check.data.supportedIds);

  const checked = toBlueprintContent({
    documents: extractionDocuments,
    extraction: extraction.data,
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
          checked: toReadSubjects(extraction.data),
          content,
          documents: extractionDocuments,
          findings,
          read: extraction.data,
        })
      : null,
    provenance: {
      generatedAt: extraction.provenance.generatedAt,
      model: extraction.provenance.model,
      promptVersion: extraction.provenance.promptVersion,
      runId: extraction.provenance.runId,
    },
    reusePolicy: toReusePolicy({ extraction: extraction.data, facts, supportedIds }),
    usable: isUsableBlueprint({ content, shared }),
  };
}
