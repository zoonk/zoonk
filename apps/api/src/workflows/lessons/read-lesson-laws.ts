import { type LessonLaw } from "@zoonk/ai/tasks/lesson-laws";
import { type FoundLessonLaw } from "@zoonk/core/library/lessons/laws";
import { getLawLookupToken } from "@zoonk/core/library/sources/law-identity";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { startOnce, waitForRun } from "../_shared/run-token";
import { type LawToLookUp, lawSourceWorkflow } from "../research/law-source-workflow";
import { readLawLookupStep } from "../research/steps/law-source-steps";
import { linkLessonLawsStep, nameLessonLawsStep } from "./steps/lesson-laws-step";

function toLawToLookUp(law: LessonLaw): LawToLookUp {
  return {
    country: law.country,
    language: law.language,
    name: law.name,
    officialDomains: law.officialDomains,
    queries: law.queries,
    searchTerms: law.searchTerms,
  };
}

async function lookUpLaw(lessonLaw: LessonLaw): Promise<string | null> {
  const law = toLawToLookUp(lessonLaw);
  const known = await readLawLookupStep(law);

  if (known) {
    return known.sourceId;
  }

  await waitForRun(await startOnce(lawSourceWorkflow, [{ law }], getLawLookupToken(law)));

  const looked = await readLawLookupStep(law);
  return looked?.sourceId ?? null;
}

function toFound({
  laws,
  lookups,
}: {
  laws: readonly LessonLaw[];
  lookups: readonly PromiseSettledResult<string | null>[];
}): FoundLessonLaw[] {
  return laws.flatMap((law, index) => {
    const lookup = lookups[index];
    const sourceId = lookup?.status === "fulfilled" ? lookup.value : null;

    return sourceId ? [{ articles: law.articles, searchTerms: law.searchTerms, sourceId }] : [];
  });
}

/**
 * Links the official text of the laws a lesson teaches before it's planned or written. A law whose
 * text can't be found or read leaves the lesson to go on without it.
 */
export async function readLessonLaws(input: {
  analytics?: ContentAnalytics;
  lessonId: string;
  workflowRunId: string;
}): Promise<void> {
  const [named] = await Promise.allSettled([nameLessonLawsStep(input)]);

  if (named.status === "rejected" || !named.value || named.value.laws.length === 0) {
    return;
  }

  const { laws, prompt } = named.value;
  const lookups = await Promise.allSettled(laws.map((law) => lookUpLaw(law)));
  const found = toFound({ laws, lookups });

  await linkLessonLawsStep({
    found,
    lessonId: input.lessonId,
    prompt,
    unavailable: found.length < laws.length,
  });
}
