import { describe, expect, it } from "vitest";
import {
  findEmDashes,
  findPlaceholderText,
  findUnrenderedMarkdown,
  findWritingFlaws,
} from "./text-flaws";

describe(findUnrenderedMarkdown, () => {
  it("passes the markup the player renders", () => {
    const text = [
      "Cada valor vale **10 mil viagens** e o filme se chama *Caminhos*: `COUNT(*)`.",
      "",
      "| Sensor | mm |",
      "|---|---:|",
      "| A | 49,8 |",
      "| B | **50,1** |",
      "",
      "- primeiro item",
      "* segundo _item_",
      "1. terceiro",
      "",
      String.raw`A área é $\pi r^2$, user_id fica igual, 2 * 3 * 4 e o espaço ___ é uma lacuna.`,
    ].join("\n");

    expect(findUnrenderedMarkdown({ layout: "blocks", text })).toStrictEqual([]);
  });

  it("finds italics split across lines, which the player reads line by line", () => {
    const text = "_Presidente: a sessão está aberta.\nO orador tem a palavra aqui._";

    expect(findUnrenderedMarkdown({ layout: "blocks", text })).toStrictEqual([
      expect.stringContaining("_Presidente"),
      expect.stringContaining("aqui._"),
    ]);

    expect(findUnrenderedMarkdown({ layout: "inline", text })).toStrictEqual([]);
  });

  it("finds bold marks the player can't pair", () => {
    expect(findUnrenderedMarkdown({ layout: "inline", text: "O valor **é 10." })).toStrictEqual([
      expect.stringContaining("**"),
    ]);
  });

  it("finds headings, links, HTML, code fences and quote marks", () => {
    const text = [
      "## Resumo",
      "Veja [a lei](https://example.com/lei).",
      "Linha um<br>linha dois",
      "```",
      "> citação",
    ].join("\n");

    expect(findUnrenderedMarkdown({ layout: "blocks", text })).toHaveLength(5);
  });

  it("finds a table in a field that shows one line, and rows without a header row", () => {
    const table = "| Sensor | mm |\n|---|---:|\n| A | 49,8 |";

    expect(findUnrenderedMarkdown({ layout: "inline", text: table })).toStrictEqual([
      expect.stringContaining("table"),
    ]);

    expect(
      findUnrenderedMarkdown({ layout: "blocks", text: "Sensores:\n| A | 49,8 |\n| B | 50,1 |" }),
    ).toStrictEqual([
      expect.stringContaining("| A | 49,8 |"),
      expect.stringContaining("| B | 50,1 |"),
    ]);
  });

  it("keeps footnote stars and lone underscores inside words as text", () => {
    const text = "Preço* em reais.\n*Fonte: IBGE.\nnome_do_arquivo e a_b";

    expect(findUnrenderedMarkdown({ layout: "blocks", text })).toStrictEqual([]);
  });
});

describe(findPlaceholderText, () => {
  it("passes real text, quotes with elisions and the learner's name slot", () => {
    expect(
      findPlaceholderText(
        String.raw`O texto diz que [...] a lei vale, {{NAME}}, e $\frac{1}{2}$ basta.`,
      ),
    ).toStrictEqual([]);
  });

  it("finds empty text, template slots and instructions left for a writer", () => {
    expect(findPlaceholderText("  ")).toStrictEqual([expect.stringContaining("empty")]);
    expect(findPlaceholderText("…")).toStrictEqual([expect.stringContaining("empty")]);

    expect(findPlaceholderText("Olá, {{nome}}!")).toStrictEqual([
      expect.stringContaining("{{nome}}"),
    ]);

    expect(findPlaceholderText("[Inserir exemplo aqui]")).toHaveLength(1);
    expect(findPlaceholderText("TODO: explicar")).toHaveLength(1);
    expect(findPlaceholderText("Lorem ipsum dolor")).toHaveLength(1);
    expect(findPlaceholderText("Write <insert name> here")).toHaveLength(1);
  });
});

describe(findEmDashes, () => {
  it("finds em dashes and keeps en dashes, which join ranges", () => {
    expect(findEmDashes("Competência 1 — domínio da escrita")).toStrictEqual([
      expect.stringContaining("Competência 1"),
    ]);

    expect(findEmDashes("Níveis B1–B2, de 2020-2024")).toStrictEqual([]);
  });

  it("finds them anywhere in a JSON value, such as an essay's rubric", () => {
    const rubric = [
      { criterion: "Competência 1 — norma culta", points: null },
      { criterion: "Competência 2", points: null },
    ];

    expect(findEmDashes({ rubric })).toStrictEqual([expect.stringContaining("Competência 1")]);
  });
});

describe(findWritingFlaws, () => {
  it("names each kind of flaw in a text learners read", () => {
    expect(
      findWritingFlaws({ layout: "inline", text: "TODO: ler **tabelas — e gráficos" }).map(
        (flaw) => flaw.kind,
      ),
    ).toStrictEqual(["emDash", "markdown", "placeholder"]);
  });
});
