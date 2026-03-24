import { type Task } from "@/lib/types";
import {
  type ActivityGrammarEnrichmentParams,
  type ActivityGrammarEnrichmentSchema,
  generateActivityGrammarEnrichment,
} from "@zoonk/ai/tasks/activities/language/grammar-enrichment";
import { TEST_CASES } from "./test-cases";

export const activityGrammarEnrichmentTask: Task<
  ActivityGrammarEnrichmentParams,
  ActivityGrammarEnrichmentSchema
> = {
  description:
    "Generate user-language enrichment (translations, discovery question, rule summary, feedback) for grammar activities",
  generate: generateActivityGrammarEnrichment,
  id: "activity-grammar-enrichment",
  name: "Activity Grammar Enrichment",
  testCases: TEST_CASES,
};
