import { type Task } from "@/lib/types";
import {
  type SearchTermsData,
  type SearchTermsParams,
  generateSearchTerms,
} from "@zoonk/ai/tasks/identity/search-terms";
import { type LibrarySearchTermsExpected, scoreLibrarySearchTerms } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const librarySearchTermsTask: Task<
  SearchTermsParams,
  SearchTermsData,
  LibrarySearchTermsExpected
> = {
  description:
    "Write search terms that find existing Library items worded differently, for each item of a batch",
  generate: generateSearchTerms,
  id: "library-search-terms",
  name: "Library search terms",
  priorities: {
    distribution: "shared",
    first: "latency",
    reads: "Code searches Library candidates with these terms",
    reason: "It sits on the path to the first question",
    waits: "A learner waits on a new goal's path",
  },
  score: scoreLibrarySearchTerms,
  testCases: TEST_CASES,
};
