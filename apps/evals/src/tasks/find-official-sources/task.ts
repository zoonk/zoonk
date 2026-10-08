import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type FindOfficialSourcesParams,
  findOfficialSources,
} from "@zoonk/ai/tasks/v2/research/find-official-sources";
import { TEST_CASES } from "./test-cases";

export type FindOfficialSourcesExpected = {
  /** Where the organizer publishes. A document on any of them counts as found. */
  officialDomains: string[];
  /** Words the current notice's address or title contains, such as its year. */
  noticeHints: string[];
};

type FoundOutput = {
  documents: { kind: string; title: string; url: string }[];
  officialFound: boolean;
  searchCalls: number;
};

function parseOutput(output: string): FoundOutput | null {
  try {
    return JSON.parse(output) as FoundOutput;
  } catch {
    return null;
  }
}

function isOnDomain({ domains, url }: { domains: string[]; url: string }): boolean {
  const hostname = URL.canParse(url) ? new URL(url).hostname.replace(/^www\./u, "") : "";
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

/**
 * 10 when an official document of the current edition is found, 8 when only an
 * official page is, 7 when only secondary sources are, 6 when nothing is.
 */
const scoreFoundSources: TaskScorer<FindOfficialSourcesExpected> = ({ output, testCase }) => {
  const found = parseOutput(output);
  const expected = testCase.expected;

  if (!found || !expected) {
    return createFixedScore({ conclusion: "No output", score: 6 });
  }

  const official = found.documents.filter((document) =>
    isOnDomain({ domains: expected.officialDomains, url: document.url }),
  );

  const current = official.filter((document) =>
    expected.noticeHints.some((hint) =>
      `${document.url} ${document.title}`.toLowerCase().includes(hint.toLowerCase()),
    ),
  );

  if (current.length > 0) {
    return createFixedScore({ conclusion: "None", score: 10 });
  }

  if (official.length > 0) {
    return createFixedScore({
      conclusion: "Official site found, but not the current edition's document",
      score: 8,
    });
  }

  return createFixedScore({
    conclusion: found.documents.length > 0 ? "Only secondary sources" : "Nothing found",
    score: found.documents.length > 0 ? 7 : 6,
  });
};

export const findOfficialSourcesTask: Task<
  FindOfficialSourcesParams,
  FoundOutput,
  FindOfficialSourcesExpected
> = {
  description:
    "Find an exam's current official notice with each search tool (gateway Exa, Parallel, Perplexity, or the model's own), and a big subject's reference syllabi with the production tool",
  generate: findOfficialSources,
  id: "find-official-sources",
  name: "Find Official Sources",
  score: scoreFoundSources,
  testCases: TEST_CASES,
};
