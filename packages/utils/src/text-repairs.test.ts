import { describe, expect, it } from "vitest";
import { findUnrenderedMarkdown } from "./text-flaws";
import { repairMarkdown, toPlainLine } from "./text-repairs";

describe(repairMarkdown, () => {
  it("leaves text the player renders exactly as written", () => {
    const text = [
      "Cada valor vale **10 mil viagens** e o filme se chama *Caminhos*: `COUNT(*)`.",
      "",
      "| Sensor | mm |",
      "|---|---:|",
      "| A | 49,8 |",
      "",
      String.raw`A área é $\pi r^2$, user_id fica igual e 2 * 3 * 4 também.`,
    ].join("\r\n");

    expect(repairMarkdown({ layout: "blocks", text })).toBe(text);
  });

  it("takes out italics split across lines, keeping the words", () => {
    const text = "_Presidente: a sessão está aberta.\nO orador tem a palavra aqui._";
    const repaired = repairMarkdown({ layout: "blocks", text });

    expect(repaired).toBe("Presidente: a sessão está aberta.\nO orador tem a palavra aqui.");
    expect(findUnrenderedMarkdown({ layout: "blocks", text: repaired })).toStrictEqual([]);
  });

  it("takes out bold marks nobody can pair and keeps the ones that pair", () => {
    expect(repairMarkdown({ layout: "blocks", text: "O **total** é **10 reais." })).toBe(
      "O **total** é 10 reais.",
    );
  });

  it("keeps math and code as written while taking out stray marks around them", () => {
    const text = String.raw`Use $a_1 + a_2$ e \`x_y\`, depois veja **isto.`;

    expect(repairMarkdown({ layout: "blocks", text })).toBe(
      String.raw`Use $a_1 + a_2$ e \`x_y\`, depois veja isto.`,
    );
  });

  it("turns headings, quote marks, links and styling tags into plain words", () => {
    const text = [
      "## Resumo",
      "> citação do texto",
      "Veja [a lei](https://example.com/lei) e <strong>leia</strong> tudo.<br>Depois responda.",
    ].join("\n");

    const repaired = repairMarkdown({ layout: "blocks", text });

    expect(repaired).toBe(
      ["Resumo", "citação do texto", "Veja a lei e leia tudo.", "Depois responda."].join("\n"),
    );

    expect(findUnrenderedMarkdown({ layout: "blocks", text: repaired })).toStrictEqual([]);
  });

  it("keeps a list's marks and a comparison that only looks like a quote", () => {
    const text = "- **um item\n> 5 anos: acima do limite";
    const repaired = repairMarkdown({ layout: "blocks", text });

    expect(repaired).toBe("- um item\n> 5 anos: acima do limite");
    expect(findUnrenderedMarkdown({ layout: "blocks", text: repaired })).toHaveLength(1);
  });

  it("repairs marks inside a table's cells without breaking the table", () => {
    const text = "| Termo | Exemplo |\n|---|---|\n| **dolo | [art. 18](https://lei) |";

    expect(repairMarkdown({ layout: "blocks", text })).toBe(
      "| Termo | Exemplo |\n|---|---|\n| dolo | art. 18 |",
    );
  });

  it("joins a one-line field's lines, which it never showed, while repairing it", () => {
    expect(repairMarkdown({ layout: "inline", text: "## Um **título\n  em duas linhas" })).toBe(
      "Um título em duas linhas",
    );
  });

  it("leaves what code can't repair for a writer", () => {
    const table = "| Sensor | mm |\n|---|---:|\n| A | 49,8 |";
    const rows = "| A | 49,8 |\n| B | 50,1 |";
    const fence = "```\nprint(1)\n```";

    expect(repairMarkdown({ layout: "inline", text: table })).toBe(table);
    expect(repairMarkdown({ layout: "blocks", text: rows })).toBe(rows);
    expect(repairMarkdown({ layout: "blocks", text: fence })).toBe(fence);
  });
});

describe(toPlainLine, () => {
  it("reads marked words as plain words on one line, without em dashes", () => {
    expect(toPlainLine("  **Calcular** juros — _compostos_\n em `planilhas`  ")).toBe(
      "Calcular juros, compostos em planilhas",
    );
  });

  it("takes out headings, links, tags and marks nobody can pair", () => {
    expect(toPlainLine("# [Ler gráficos](https://x.y) <em>e tabelas</em> **já")).toBe(
      "Ler gráficos e tabelas já",
    );
  });

  it("keeps angle quotes and multiplication as text", () => {
    expect(toPlainLine("O «bem comum» e 2 * 3")).toBe("O «bem comum» e 2 * 3");
  });
});
