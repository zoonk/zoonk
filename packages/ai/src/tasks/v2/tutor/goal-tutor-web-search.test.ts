import { logError } from "@zoonk/utils/logger";
import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type PlanScopeContext } from "../../lessons/lesson-question-context";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { type GoalTutorSearchResult, createSearchWebTool } from "./goal-tutor-web-search";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./goal-tutor-web-search.prompt.md", () => ({ default: "Search these queries." }));
vi.mock("@zoonk/utils/logger", () => ({ logError: vi.fn() }));

/** The search is a model call through the gateway: these tests stand in for what it returns. */
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const PLAN = {
  catchUp: null,
  challenges: [],
  course: null,
  estimate: { endDate: "2027-01-09", remainingHours: 190 },
  exam: null,
  goal: {
    cutoff: null,
    dailyMinutes: 120,
    kind: "exam",
    target: null,
    targetDate: "2027-01-10",
    title: "OAB da Sofia",
  },
  language: "pt",
  mistakes: [],
  next: [],
  phase: null,
  scope: { kind: "plan" },
  setup: null,
  status: null,
  today: null,
  version: 1,
} satisfies PlanScopeContext;

const SEARCHED = { objective: "Fontes atuais.", search_queries: ["ADI 1194 STF cláusula"] };

/** A source as the gateway sends it (14 Oct 2026), not as `@ai-sdk/gateway` declares it. */
const STF_SOURCE = {
  excerpts: ["O STF julgou a ADI 1194.", "Tese fixada."],
  publish_date: "2026-09-01",
  title: "ADI 1194",
  url: "https://portal.stf.jus.br/adi-1194",
};

/** What the search found: the STF's page. */
const FOUND = { results: [STF_SOURCE], search_id: "search-1" };

/** A search that called the tool once and returned this. */
function searchResult(output: unknown = FOUND) {
  const result = createGenerateTextResult(null, "openai/gpt-6-luna");

  const step = {
    ...result.finalStep,
    staticToolCalls: [{ input: SEARCHED, toolName: "searchWeb" }],
    staticToolResults: [{ output, toolName: "searchWeb" }],
  };

  return { ...result, steps: [step] } as typeof result;
}

/** The buddy's search for one message. */
function searchTool() {
  return createSearchWebTool({ contextSnapshot: PLAN, learnerMemory: ["Trabalha no BNDES"] });
}

function callSearch({
  abortSignal,
  queries,
  tool,
}: {
  abortSignal?: AbortSignal;
  queries: string[];
  tool: ReturnType<typeof searchTool>;
}) {
  return Promise.resolve(
    tool.execute?.({ queries }, { abortSignal, context: {}, messages: [], toolCallId: "1" }),
  ) as Promise<GoalTutorSearchResult>;
}

function search(queries: string[], abortSignal?: AbortSignal) {
  return callSearch({ abortSignal, queries, tool: searchTool() });
}

describe(createSearchWebTool, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the search only the query built in code, and what it found to the buddy", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(searchResult());

    await expect(
      search(["ADI 1194 STF cláusula Sofia sofia@gmail.com BNDES 1990", "Sofia"]),
    ).resolves.toStrictEqual({
      results: [
        {
          excerpt: "O STF julgou a ADI 1194.\n\nTese fixada.",
          publishDate: "2026-09-01",
          title: "ADI 1194",
          url: "https://portal.stf.jus.br/adi-1194",
        },
      ],
      searched: [SEARCHED],
      status: "found",
    });

    const options = vi.mocked(generateText).mock.lastCall?.[0];

    expect(options?.prompt).toBe("ADI 1194 STF cláusula");
    expect(options?.instructions).toBe("Search these queries.");
    expect(options?.toolChoice).toStrictEqual({ toolName: "searchWeb", type: "tool" });
  });

  it("gives the buddy at most five sources of up to 1,500 characters each, once each", async () => {
    // As `@ai-sdk/gateway` declares a source, should the gateway's output change to match it.
    const sources = Array.from({ length: 7 }, (_, index) => ({
      excerpt: "a".repeat(2000),
      publishDate: null,
      title: "Fonte",
      url: `https://example.com/${index}`,
    }));

    vi.mocked(generateText).mockResolvedValueOnce(
      searchResult({ results: [STF_SOURCE, STF_SOURCE, ...sources], searchId: "search-1" }),
    );

    const result = await search(["ADI 1194 STF"]);
    const results = result.status === "found" ? result.results : [];

    expect(results.map(({ url }) => url)).toStrictEqual([
      STF_SOURCE.url,
      "https://example.com/0",
      "https://example.com/1",
      "https://example.com/2",
      "https://example.com/3",
    ]);

    expect(results.at(-1)?.excerpt).toHaveLength(1500);
  });

  it("searches nothing when nothing but the learner's data was proposed", async () => {
    await expect(search(["Sofia BNDES sofia@gmail.com"])).resolves.toStrictEqual({
      status: "nothingToSearch",
    });

    expect(generateText).not.toHaveBeenCalled();
  });

  it("searches once per message, even when the model calls it twice in one step", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(searchResult());
    const tool = searchTool();

    const [first, second] = await Promise.all([
      callSearch({ queries: ["ADI 1194 STF"], tool }),
      callSearch({ queries: ["Súmula 331 TST"], tool }),
    ]);

    expect(generateText).toHaveBeenCalledOnce();
    expect(second).toStrictEqual(first);
  });

  it("answers without the search when it fails, logging only the failure's kind", async () => {
    vi.mocked(generateText).mockRejectedValueOnce(
      new Error("Gateway unavailable for query ADI 1194 STF"),
    );

    await expect(search(["ADI 1194 STF"])).resolves.toStrictEqual({ status: "unavailable" });
    expect(logError).toHaveBeenCalledWith("[Goal Tutor Web Search Error]", { name: "Error" });
    expect(JSON.stringify(vi.mocked(logError).mock.calls)).not.toContain("ADI");

    vi.mocked(generateText).mockResolvedValueOnce(
      searchResult({ error: "rate_limit", message: "Too many requests" }),
    );

    await expect(search(["ADI 1194 STF"])).resolves.toStrictEqual({ status: "unavailable" });
  });

  it("answers without the search when it runs past its deadline", async () => {
    const deadline = new AbortController();

    vi.mocked(generateText).mockImplementationOnce(
      ({ abortSignal }) =>
        new Promise((_, reject) => {
          abortSignal?.addEventListener(
            "abort",
            () => reject(new Error("The search was aborted", { cause: abortSignal.reason })),
            { once: true },
          );
        }),
    );

    const searching = search(["ADI 1194 STF"], deadline.signal);
    deadline.abort(new DOMException("The operation timed out.", "TimeoutError"));

    await expect(searching).resolves.toStrictEqual({ status: "unavailable" });
    expect(vi.mocked(generateText).mock.lastCall?.[0].abortSignal).toBe(deadline.signal);
  });
});
