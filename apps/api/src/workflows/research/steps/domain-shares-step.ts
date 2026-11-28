import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { findDomainShares } from "@zoonk/ai/tasks/research/find-domain-shares";
import { applyDomainShares, listShareSubjects } from "@zoonk/core/library/exams/domain-shares";
import { loadSourceDocuments } from "@zoonk/core/library/sources/load-documents";
import { type ResearchAnalytics } from "../_utils/research-analytics";
import { type BlueprintReading } from "./extract-blueprint-step";

/** Each heading's official share of its subject, read from the reading's own documents. */
export async function readDomainSharesStep({
  analytics,
  background,
  exam,
  reading,
  sourceIds,
}: {
  analytics: ResearchAnalytics;
  background: boolean;
  exam: string;
  reading: BlueprintReading;
  sourceIds: string[];
}): Promise<BlueprintReading> {
  "use step";
  const subjects = listShareSubjects(reading.content);

  if (subjects.length === 0) {
    return reading;
  }

  const documents = await loadSourceDocuments(sourceIds);

  const { data } = await findDomainShares({
    analytics,
    documents,
    exam,
    serviceTier: chooseServiceTier({ wait: background ? "later" : "learner" }),
    subjects,
  });

  const content = applyDomainShares({
    content: reading.content,
    documents: documents.map((document) => ({ sourceId: document.id, text: document.text })),
    findings: data,
  });

  return { ...reading, content };
}
