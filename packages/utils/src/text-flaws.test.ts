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

  it("finds headings, links, HTML and quote marks", () => {
    const text = [
      "## Resumo",
      "Veja [a lei](https://example.com/lei).",
      "Linha um<br>linha dois",
      "> citação",
    ].join("\n");

    expect(findUnrenderedMarkdown({ layout: "blocks", text })).toHaveLength(4);
  });

  it("finds a tag outside code and says how to show it", () => {
    expect(
      findUnrenderedMarkdown({ layout: "inline", text: "Wrap it in <p> and </p>." }),
    ).toStrictEqual([expect.stringContaining("in backticks, as in `<h1>`")]);

    for (const text of [
      "<fieldset><legend>Contact</legend></fieldset>",
      'Add <button type="submit"> inside the form.',
      "Use <xsl:text>Yes</xsl:text> here.",
      "Close it with <br/>.",
    ]) {
      expect(findUnrenderedMarkdown({ layout: "inline", text })).toStrictEqual([
        expect.stringContaining("an HTML tag"),
      ]);
    }
  });

  it("keeps angle quotes, comparisons and links apart from tags", () => {
    for (const text of ["O «bem comum» e o <<bem comum>>", "Se 3 < 5 e 7 > 2, então", "x<5"]) {
      expect(findUnrenderedMarkdown({ layout: "inline", text })).toStrictEqual([]);
    }

    expect(
      findUnrenderedMarkdown({ layout: "inline", text: "Abra <https://zoonk.com/a?b=1>." }),
    ).toStrictEqual([expect.stringContaining("a link's angle brackets")]);
  });

  it("finds tags written as HTML escapes outside code, and keeps them in code", () => {
    for (const text of [
      "In &lt;h1&gt;Our Services&lt;/h1&gt;, visitors see only _Our Services_.",
      "&nbsp;&nbsp;<li>Home</li>",
      "Use &#60;p&#62; or &#x3C;p&#x3E;.",
      "Caf&eacute; &mdash; aberto",
      "Ein gro&szlig;er Balkon in M&uuml;nchen",
    ]) {
      expect(findUnrenderedMarkdown({ layout: "blocks", text })).toContainEqual(
        expect.stringContaining("an HTML escape"),
      );
    }

    for (const text of [
      "To show a `<` on a page, write `&lt;`.",
      "```html\n<p>Use &lt;h1&gt; for the title.</p>\n```",
      "AT&T and R&D; pay 5 & 6.",
      "They stayed in B&Bs; hotels cost more.",
    ]) {
      expect(findUnrenderedMarkdown({ layout: "blocks", text })).toStrictEqual([]);
    }
  });

  it("finds inline code between two backticks, which no player reads as code", () => {
    expect(
      findUnrenderedMarkdown({ layout: "inline", text: "Write ``const s = `hi`;`` here." }),
    ).toStrictEqual([expect.stringContaining("two backticks")]);
  });

  it("reads a code block as code, whatever marks its lines hold", () => {
    const text = [
      "O que esta função mostra?",
      "```python",
      "# soma tudo",
      "def total(*args, **kwargs):",
      "    return sum(args)  # [ver](https://docs.python.org)",
      "```",
      "```html",
      "<div>> oi</div>",
      "```",
    ].join("\n");

    expect(findUnrenderedMarkdown({ layout: "blocks", text })).toStrictEqual([]);
  });

  it("reads inline code as code, whatever tags or links it holds", () => {
    const text = "O que `<div>` contém, e o que `[a](b)` mostra?";

    expect(findUnrenderedMarkdown({ layout: "inline", text })).toStrictEqual([]);
    expect(findUnrenderedMarkdown({ layout: "blocks", text })).toStrictEqual([]);
  });

  it("reads a block fenced with tildes as code, as every player draws it", () => {
    const text = "Veja:\n~~~html\n<div>## oi</div>\n~~~";

    expect(findUnrenderedMarkdown({ layout: "blocks", text })).toStrictEqual([]);

    expect(
      findUnrenderedMarkdown({ layout: "blocks", text: "Veja:\n~~~js\nconsole.log(1);" }),
    ).toStrictEqual([expect.stringContaining("~~~")]);

    expect(
      findUnrenderedMarkdown({ layout: "inline", text: "Rode:\n~~~js\nf();\n~~~" }),
    ).toStrictEqual([expect.stringContaining("code fence"), expect.stringContaining("code fence")]);
  });

  it("finds a code block that never closes, and one with words around it where one line shows", () => {
    const open = "Veja:\n```js\nconsole.log(1);\nO console mostra 1.";

    expect(findUnrenderedMarkdown({ layout: "blocks", text: open })).toStrictEqual([
      expect.stringContaining("never closes"),
    ]);

    expect(
      findUnrenderedMarkdown({ layout: "inline", text: "Rode:\n```js\nconsole.log(1);\n```" }),
    ).toStrictEqual([expect.stringContaining("code fence"), expect.stringContaining("code fence")]);
  });

  it("passes an option that is one code block and nothing else", () => {
    const option = "```python\nif x_1 > 0:\n    print(**dados)\n```";

    expect(findUnrenderedMarkdown({ layout: "inline", text: option })).toStrictEqual([]);
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
  it("passes real text, quotes with elisions and a template's slots in code", () => {
    expect(
      findPlaceholderText(String.raw`O texto diz que [...] a lei vale, e $\frac{1}{2}$ basta.`),
    ).toStrictEqual([]);

    expect(findPlaceholderText("O Vue mostra:\n```html\n<p>{{ nome }}</p>\n```")).toStrictEqual([]);
    expect(findPlaceholderText("No Vue, `{{ nome }}` mostra o nome.")).toStrictEqual([]);
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
