import { describe, expect, it, vi } from "vitest";
import {
  buildResearchSearchTools,
  collectSearchedHosts,
  isOnSearchedHost,
} from "./research-search-tools";

vi.mock("server-only", () => ({}));

describe(collectSearchedHosts, () => {
  it("collects sites from native sources and gateway tool results, without www", () => {
    const hosts = collectSearchedHosts({
      sources: [{ sourceType: "url", url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/enem" }],
      toolResults: [
        {
          output: {
            results: [
              {
                title: "Edital",
                url: "https://download.inep.gov.br/edital/2026/edital_enem_2026.pdf",
              },
            ],
          },
          type: "tool-result",
        },
      ],
    });

    expect([...hosts].toSorted()).toStrictEqual(["download.inep.gov.br", "gov.br"]);
  });
});

describe(isOnSearchedHost, () => {
  const hosts = new Set(["download.inep.gov.br", "cebraspe.org.br"]);

  it("keeps deep links on a searched site", () => {
    expect(
      isOnSearchedHost({ hosts, url: "https://www.cebraspe.org.br/concursos/tj_ce_26/edital.pdf" }),
    ).toBe(true);
  });

  it("drops documents on sites no search returned", () => {
    expect(isOnSearchedHost({ hosts, url: "https://inep-edital.example.com/enem.pdf" })).toBe(
      false,
    );

    expect(isOnSearchedHost({ hosts, url: "not a url" })).toBe(false);
  });
});

describe(buildResearchSearchTools, () => {
  it("names every tool the same way so the prompt reads alike", () => {
    expect(
      Object.keys(buildResearchSearchTools({ model: "openai/gpt-6-sol", searchTool: "exa" })),
    ).toStrictEqual(["web_search"]);

    expect(
      Object.keys(
        buildResearchSearchTools({ model: "anthropic/claude-opus-5.5", searchTool: "native" }),
      ),
    ).toStrictEqual(["web_search"]);
  });

  it("refuses built-in search for a provider without one", () => {
    expect(() =>
      buildResearchSearchTools({ model: "deepseek/deepseek-v4-pro", searchTool: "native" }),
    ).toThrow("No built-in search");
  });
});
