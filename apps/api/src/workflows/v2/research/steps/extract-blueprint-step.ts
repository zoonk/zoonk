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
  /** Facts extracted, and those both checks kept. */
  facts: { extracted: number; kept: number };
  /**
   * What the check of a shared exam's reading found it left out (`findReadingProblems`); null for
   * a learner's own material, which isn't checked, and when the check itself failed.
   */
  problems: ReadingProblem[] | null;
  provenance: { generatedAt: string; model: string; promptVersion: string; runId: string };
  reusePolicy: { policy: ReusePolicy; sourceId: string } | null;
  usable: boolean;
};

/** The subjects the reading listed, as its check reads them, in the reading's order. */
function toReadSubjects(extraction: BlueprintExtraction) {
  return extraction.subjects.map((subject) => ({
    name: subject.name,
    questions: subject.questions,
  }));
}

/**
 * The check of a shared exam's reading (`checkExamReading`), beside the citation checks, so it
 * never adds to the reading's wait. A check that fails leaves the reading unchecked (null): it's
 * used as it is, never read again for a check that couldn't run.
 */
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

/**
 * The reading's pass marks in the app's languages (`translatePassMarks`), beside the checks, so it
 * never adds to the reading's wait. A translation that fails leaves the notice's own words, which
 * screens say the language of.
 */
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

/**
 * Reads an exam's documents into a blueprint and checks every fact twice:
 * code confirms its passage is in the document, then a second model confirms
 * the fact says no more than its passage. Only facts that pass both are kept,
 * each detail on its own (a subject stays when its question count doesn't).
 * A shared exam's reading is also checked for what it left out, at the same
 * time (`problems`), and its pass marks are translated into the app's
 * languages; `corrections` tells a reading again what an earlier one left out.
 * The first document is the notice whose hash the blueprint records.
 */
export async function extractBlueprintStep({
  analytics,
  background,
  corrections = [],
  exam,
  shared,
  sourceIds,
}: {
  analytics: ResearchAnalytics;
  /** Nobody waits on the reading (a freshness check), so it's read at the flex tier. */
  background: boolean;
  /** What the check of an earlier reading of the same documents found it left out. */
  corrections?: ReadingProblem[];
  exam: string;
  /** The reading becomes a shared blueprint, which must read as an exam (`isUsableBlueprint`). */
  shared: boolean;
  sourceIds: string[];
}): Promise<BlueprintReading> {
  "use step";

  const documents = await loadSourceDocuments(sourceIds);
  const [notice] = documents;

  if (!notice) {
    throw new FatalError("None of the research sources exist anymore.");
  }

  // An exam's published notice serves every learner of that exam; a learner's own upload, them.
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

  // A learner's own notes read as their headings: "4) Organelles (ALWAYS ON THE TEST!!)" is "Organelles",
  // which comes up a lot.
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
