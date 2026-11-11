import { type LessonLaw } from "@zoonk/ai/tasks/lesson-laws";
import { type FoundSourceDocument } from "@zoonk/ai/tasks/research/find-official-sources";
import { isOfficialSite } from "@zoonk/core/library/sources/law-identity";
import { getWorkflowMetadata } from "workflow";
import { type ResearchAnalytics } from "./_utils/research-analytics";
import { findSourcesStep } from "./steps/find-sources-step";
import {
  acceptLawSourceStep,
  findStoredLawSourceStep,
  readLawLookupStep,
  recordLawLookupStep,
} from "./steps/law-source-steps";
import { storeSource } from "./steps/store-sources-step";

export type LawToLookUp = Omit<LessonLaw, "articles">;

/** Some official sites refuse downloads, so a law has up to 3 addresses of the same text. */
const MAX_LAW_ADDRESSES = 3;

function listOfficialAddresses({
  documents,
  law,
}: {
  documents: readonly FoundSourceDocument[];
  law: LawToLookUp;
}): FoundSourceDocument[] {
  return documents
    .filter(
      (document) =>
        document.kind === "official" &&
        isOfficialSite({ domains: law.officialDomains, url: document.url }),
    )
    .slice(0, MAX_LAW_ADDRESSES);
}

async function storeLawText({
  analytics,
  document,
  law,
}: {
  analytics: ResearchAnalytics;
  document: FoundSourceDocument;
  law: LawToLookUp;
}): Promise<string | null> {
  const [stored] = await Promise.allSettled([
    storeSource({
      analytics,
      // Learners see this title in citations, and a page's own can be just "L9784".
      document: { ...document, title: law.name },
      language: law.language,
      officialDomains: law.officialDomains,
      topic: "regulation",
    }),
  ]);

  if (stored.status === "rejected") {
    return null;
  }

  const accepted = await acceptLawSourceStep({ law, sourceId: stored.value.sourceId });
  return accepted ? stored.value.sourceId : null;
}

/** In order, until one downloads whole from an official site and reads as the law. */
function storeFirstLawText({
  addresses,
  analytics,
  law,
}: {
  addresses: readonly FoundSourceDocument[];
  analytics: ResearchAnalytics;
  law: LawToLookUp;
}): Promise<string | null> {
  return addresses.reduce<Promise<string | null>>(
    async (previous, document) => (await previous) ?? storeLawText({ analytics, document, law }),
    Promise.resolve(null),
  );
}

async function findLawSource({
  analytics,
  law,
}: {
  analytics: ResearchAnalytics;
  law: LawToLookUp;
}): Promise<string | null> {
  const stored = await findStoredLawSourceStep(law);

  if (stored || law.queries.length === 0) {
    return stored;
  }

  const found = await findSourcesStep({
    analytics,
    plan: { ...law, product: null },
    topic: "regulation",
  });

  return storeFirstLawText({
    addresses: listOfficialAddresses({ documents: found.documents, law }),
    analytics,
    law,
  });
}

/**
 * Finds a law's official text once for every lesson naming it. A search that fails after its
 * retries is recorded as finding nothing, so lessons go on without the text until it's looked up
 * again.
 */
export async function lawSourceWorkflow({ law }: { law: LawToLookUp }): Promise<void> {
  "use workflow";

  if (await readLawLookupStep(law)) {
    return;
  }

  const { workflowRunId } = getWorkflowMetadata();
  const analytics: ResearchAnalytics = { contentScope: "shared", traceId: workflowRunId };
  const [found] = await Promise.allSettled([findLawSource({ analytics, law })]);
  const sourceId = found.status === "fulfilled" ? found.value : null;

  await recordLawLookupStep({ law, sourceId });

  if (found.status === "rejected") {
    throw found.reason;
  }
}
