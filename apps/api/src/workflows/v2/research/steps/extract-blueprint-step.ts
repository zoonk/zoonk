import { checkCitedFacts } from "@zoonk/ai/tasks/v2/research/check-cited-facts";
import { extractExamBlueprint } from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint";
import {
  isUsableBlueprint,
  toBlueprintContent,
  toReusePolicy,
} from "@zoonk/core/library/exams/blueprint-content";
import { type BlueprintContent } from "@zoonk/core/library/exams/blueprint-contract";
import {
  listBlueprintFacts,
  toCheckBatches,
  toCitedFacts,
} from "@zoonk/core/library/exams/blueprint-facts";
import { type ReusePolicy } from "@zoonk/core/library/sources/contract";
import { loadSourceDocuments } from "@zoonk/core/library/sources/load-documents";
import { FatalError } from "workflow";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ResearchAnalytics } from "../_utils/research-analytics";

export type BlueprintReading = {
  content: BlueprintContent;
  /** Facts extracted, and those both checks kept. */
  facts: { extracted: number; kept: number };
  provenance: { generatedAt: string; model: string; promptVersion: string; runId: string };
  reusePolicy: { policy: ReusePolicy; sourceId: string } | null;
  usable: boolean;
};

/**
 * Reads an exam's documents into a blueprint and checks every fact twice:
 * code confirms its passage is in the document, then a second model confirms
 * the fact says no more than its passage. Only facts that pass both are kept,
 * each detail on its own (a subject stays when its question count doesn't).
 * The first document is the notice whose hash the blueprint records.
 */
export async function extractBlueprintStep({
  analytics,
  exam,
  priority,
  sourceIds,
}: {
  analytics: ResearchAnalytics;
  exam: string;
  /** A learner's new plan waits on the reading, so it's read at the priority tier. */
  priority: boolean;
  sourceIds: string[];
}): Promise<BlueprintReading> {
  "use step";

  const documents = await loadSourceDocuments(sourceIds);
  const [notice] = documents;

  if (!notice) {
    throw new FatalError("None of the research sources exist anymore.");
  }

  const extraction = await withAiRetry(() =>
    extractExamBlueprint({
      analytics,
      documents,
      exam,
      serviceTier: priority ? "priority" : undefined,
    }),
  );

  const extractionDocuments = documents.map((document) => ({
    sourceId: document.id,
    text: document.text,
  }));

  const facts = listBlueprintFacts({ documents: extractionDocuments, extraction: extraction.data });
  const citedFacts = toCitedFacts(facts);

  const checks = await Promise.all(
    toCheckBatches(citedFacts).map((batch) =>
      withAiRetry(() => checkCitedFacts({ analytics, facts: batch })),
    ),
  );

  const supportedIds = checks.flatMap((check) => check.data.supportedIds);

  const content = toBlueprintContent({
    documents: extractionDocuments,
    extraction: extraction.data,
    facts,
    noticeUrl: notice.url,
    sourceHash: notice.contentHash,
    supportedIds,
  });

  return {
    content,
    facts: { extracted: facts.length, kept: supportedIds.length },
    provenance: {
      generatedAt: extraction.provenance.generatedAt,
      model: extraction.provenance.model,
      promptVersion: extraction.provenance.promptVersion,
      runId: extraction.provenance.runId,
    },
    reusePolicy: toReusePolicy({ extraction: extraction.data, facts, supportedIds }),
    usable: isUsableBlueprint(content),
  };
}
