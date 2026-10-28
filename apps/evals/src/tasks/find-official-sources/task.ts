import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type FindOfficialSourcesParams,
  findOfficialSources,
} from "@zoonk/ai/tasks/v2/research/find-official-sources";
import { fetchDocument } from "@zoonk/core/library/sources/fetch";
import { parseDocument } from "@zoonk/core/library/sources/parse-document";
import { normalizeString } from "@zoonk/utils/string";
import { TEST_CASES } from "./test-cases";

export type FindOfficialSourcesExpected = {
  officialDomains: string[];
  noticeHints: string[];
  sectionHints?: string[];
  copies?: { contentHints: string[]; refusingSites: string[] };
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

function listMissingSections({
  expected,
  official,
}: {
  expected: FindOfficialSourcesExpected;
  official: FoundOutput["documents"];
}): string[] {
  return (expected.sectionHints ?? []).filter(
    (hint) =>
      !official.some((document) =>
        `${document.url} ${document.title}`.toLowerCase().includes(hint.toLowerCase()),
      ),
  );
}

async function readCopy(url: string): Promise<string | null> {
  try {
    const fetched = await fetchDocument(url);
    const parsed = await parseDocument({ bytes: fetched.bytes, contentType: fetched.contentType });
    return parsed.text;
  } catch {
    return null;
  }
}

async function scoreCopies({
  copies,
  found,
}: {
  copies: NonNullable<FindOfficialSourcesExpected["copies"]>;
  found: FoundOutput;
}) {
  const refused = found.documents.filter((document) =>
    isOnDomain({ domains: copies.refusingSites, url: document.url }),
  );

  const others = found.documents.filter((document) => !refused.includes(document));
  const texts = await Promise.all(others.map((document) => readCopy(document.url)));
  const readable = texts.flatMap((text) => (text ? [normalizeString(text)] : []));

  const complete = readable.some((text) =>
    copies.contentHints.every((hint) => text.includes(normalizeString(hint))),
  );

  const penalty = refused.length > 0 ? 1 : 0;
  const refusedNote = penalty > 0 ? `; ${refused.length} on a site that refused the originals` : "";

  if (complete) {
    return createFixedScore({
      conclusion: `A downloadable copy states the notice's content${refusedNote}`,
      score: 10 - penalty,
    });
  }

  if (readable.length > 0) {
    return createFixedScore({
      conclusion: `Copies download, but none states ${copies.contentHints.join(", ")}${refusedNote}`,
      score: 8 - penalty,
    });
  }

  return createFixedScore({
    conclusion: others.length > 0 ? "No copy downloads" : "No copy found",
    score: others.length > 0 ? 7 : 6,
  });
}

const scoreFoundSources: TaskScorer<FindOfficialSourcesExpected> = ({ output, testCase }) => {
  const found = parseOutput(output);
  const expected = testCase.expected;

  if (!found || !expected) {
    return createFixedScore({ conclusion: "No output", score: 6 });
  }

  if (expected.copies) {
    return scoreCopies({ copies: expected.copies, found });
  }

  const official = found.documents.filter((document) =>
    isOnDomain({ domains: expected.officialDomains, url: document.url }),
  );

  const current = official.filter((document) =>
    expected.noticeHints.some((hint) =>
      `${document.url} ${document.title}`.toLowerCase().includes(hint.toLowerCase()),
    ),
  );

  const missing = listMissingSections({ expected, official });

  if (current.length > 0 && missing.length > 0) {
    return createFixedScore({
      conclusion: `No official page for these sections' format: ${missing.join(", ")}`,
      score: 8,
    });
  }

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
