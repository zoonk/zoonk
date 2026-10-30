import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { findOfficialSources } from "./find-official-sources";
import { type ExamResearchPlan } from "./research-plan";
import type * as SearchTools from "./research-search-tools";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("./find-official-sources.prompt.md", () => ({
  default: "Find the documents.\n{{#unreadable}}\nFind copies on other sites.\n{{/unreadable}}\n",
}));

vi.mock("./research-search-tools", async (importOriginal) => ({
  ...(await importOriginal<typeof SearchTools>()),
  buildResearchSearchTools: vi.fn(() => ({})),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

function readPlan(userPrompt: string): unknown {
  return JSON.parse(userPrompt.slice(userPrompt.indexOf("PLAN:\n") + "PLAN:\n".length));
}

describe(findOfficialSources, () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({ documents: [], officialFound: false }),
    );
  });

  it("sends only the plan fields search reads, as the eval does", async () => {
    const plan: ExamResearchPlan = {
      board: "FGV",
      classTest: false,
      country: "BR",
      edition: "47",
      language: "pt",
      name: "OAB Exame de Ordem Unificado",
      officialDomains: ["oab.fgv.br"],
      queries: ["edital 47 exame de ordem"],
      role: "1ª fase",
      searchTerms: ["OAB", "Exame de Ordem"],
    };

    const { userPrompt } = await findOfficialSources({ plan, topic: "exam" });

    expect(readPlan(userPrompt)).toStrictEqual({
      board: "FGV",
      country: "BR",
      edition: "47",
      name: "OAB Exame de Ordem Unificado",
      officialDomains: ["oab.fgv.br"],
      queries: ["edital 47 exame de ordem"],
      role: "1ª fase",
    });
  });

  it("names no board, edition or role for a law's, product's or subject's plan", async () => {
    const { userPrompt } = await findOfficialSources({
      plan: {
        country: "BR",
        name: "Cálculo Diferencial e Integral",
        officialDomains: ["usp.br"],
        queries: ["ementa calculo 1"],
      },
      topic: "syllabus",
    });

    expect(readPlan(userPrompt)).toStrictEqual({
      board: null,
      country: "BR",
      edition: null,
      name: "Cálculo Diferencial e Integral",
      officialDomains: ["usp.br"],
      queries: ["ementa calculo 1"],
      role: null,
    });
  });

  it("asks for copies on other sites of the documents that couldn't be downloaded", async () => {
    const plan = {
      country: "BR",
      name: "Concurso TJ-SP",
      officialDomains: ["vunesp.com.br"],
      queries: ["edital escrevente tjsp"],
    };

    const unreadable = ["https://documento.vunesp.com.br/edital.pdf"];
    const search = await findOfficialSources({ plan, topic: "exam" });
    const copies = await findOfficialSources({ plan, topic: "exam", unreadable });

    expect(search.systemPrompt).toBe("Find the documents.\n");
    expect(search.userPrompt).not.toContain("UNREADABLE");
    expect(copies.systemPrompt).toBe("Find the documents.\nFind copies on other sites.\n");

    expect(copies.userPrompt).toContain(
      "UNREADABLE:\n- https://documento.vunesp.com.br/edital.pdf",
    );
  });
});
