import {
  markRichBlocks,
  markRichInline,
  parseRichBlocks,
  parseRichInline,
} from "@zoonk/learn/rich-text/parser";
import { describe, expect, it } from "vitest";

describe(parseRichInline, () => {
  it("reads inline and display math between dollar signs", () => {
    expect(
      parseRichInline(String.raw`So $0.75 \times 80 = 60$ and $$A = P(1+r)^t$$ too`),
    ).toStrictEqual([
      { kind: "text", text: "So " },
      { kind: "math", text: "0.75 \\times 80 = 60" },
      { kind: "text", text: " and " },
      { kind: "displayMath", text: "A = P(1+r)^t" },
      { kind: "text", text: " too" },
    ]);
  });

  it("keeps prices and currencies as text", () => {
    expect(parseRichInline("It costs $5 and $10, or R$ 80.")).toStrictEqual([
      { kind: "text", text: "It costs $5 and $10, or R$ 80." },
    ]);

    expect(parseRichInline(String.raw`Pay \$5 now`)).toStrictEqual([
      { kind: "text", text: "Pay $5 now" },
    ]);
  });

  it("reads bold, italics with stars or underscores and inline code", () => {
    expect(parseRichInline("A **cloud** of _chances_, not *paths*: `orbit()`")).toStrictEqual([
      { kind: "text", text: "A " },
      { kind: "bold", text: "cloud" },
      { kind: "text", text: " of " },
      { kind: "italic", text: "chances" },
      { kind: "text", text: ", not " },
      { kind: "italic", text: "paths" },
      { kind: "text", text: ": " },
      { kind: "code", text: "orbit()" },
    ]);
  });

  it("leaves snake_case, multiplication and emphasis markers inside code alone", () => {
    expect(parseRichInline("user_id stays, 2 * 3 * 4 too")).toStrictEqual([
      { kind: "text", text: "user_id stays, 2 * 3 * 4 too" },
    ]);

    expect(parseRichInline("`a_b_c` and `**x**`")).toStrictEqual([
      { kind: "code", text: "a_b_c" },
      { kind: "text", text: " and " },
      { kind: "code", text: "**x**" },
    ]);
  });

  it("never applies emphasis inside math", () => {
    expect(parseRichInline("$a_1 * b_2$")).toStrictEqual([{ kind: "math", text: "a_1 * b_2" }]);
  });
});

describe(parseRichBlocks, () => {
  it("groups lines into paragraphs and lists", () => {
    const blocks = parseRichBlocks(
      "The cloud shows:\n- where it's likely\n- where it isn't\n\n1. Read it\n2. Guess\n\nThat's all.",
    );

    expect(blocks.map((block) => block.kind)).toStrictEqual([
      "paragraph",
      "list",
      "list",
      "paragraph",
    ]);

    expect(blocks[1]).toStrictEqual({
      items: [
        [{ kind: "text", text: "where it's likely" }],
        [{ kind: "text", text: "where it isn't" }],
      ],
      kind: "list",
      ordered: false,
    });

    expect(blocks[2]).toMatchObject({ ordered: true });
  });

  it("keeps a single line break inside the paragraph and splits on a blank line", () => {
    expect(parseRichBlocks("First line\nsecond line\n\nNew idea")).toStrictEqual([
      {
        kind: "paragraph",
        lines: [[{ kind: "text", text: "First line" }], [{ kind: "text", text: "second line" }]],
      },
      { kind: "paragraph", lines: [[{ kind: "text", text: "New idea" }]] },
    ]);
  });

  it("reads a table of data between paragraphs, with math and emphasis in its cells", () => {
    const blocks = parseRichBlocks(
      "Uma tabela mostra as bicicletas:\n| Hora | Bicicletas |\n|---|---:|\n| 7h | 9 |\n| **8h** | $5$ |\n\nQual horário teve menos?",
    );

    expect(blocks).toStrictEqual([
      { kind: "paragraph", lines: [[{ kind: "text", text: "Uma tabela mostra as bicicletas:" }]] },
      {
        align: [null, "right"],
        header: [[{ kind: "text", text: "Hora" }], [{ kind: "text", text: "Bicicletas" }]],
        kind: "table",
        rows: [
          [[{ kind: "text", text: "7h" }], [{ kind: "text", text: "9" }]],
          [[{ kind: "bold", text: "8h" }], [{ kind: "math", text: "5" }]],
        ],
      },
      { kind: "paragraph", lines: [[{ kind: "text", text: "Qual horário teve menos?" }]] },
    ]);
  });
});

describe(markRichBlocks, () => {
  it("marks the quoted sentence by the words it shows, across emphasis, and only once", () => {
    const text =
      "A change multiplies the **current** value. Then it repeats.\n\nA change multiplies the **current** value.";

    const [first, second] = markRichBlocks(
      parseRichBlocks(text),
      "A change multiplies the **current** value.",
    );

    expect(first).toStrictEqual({
      kind: "paragraph",
      lines: [
        [
          { kind: "text", marked: true, text: "A change multiplies the " },
          { kind: "bold", marked: true, text: "current" },
          { kind: "text", marked: true, text: " value." },
          { kind: "text", text: " Then it repeats." },
        ],
      ],
    });

    expect(second).toStrictEqual(parseRichBlocks(text)[1]);
  });

  it("splits emphasis the quote starts inside and marks a formula it reaches whole", () => {
    expect(
      markRichInline(parseRichInline("**Always multiply** by $1.2$ first."), "multiply by 1"),
    ).toStrictEqual([
      { kind: "bold", text: "Always " },
      { kind: "bold", marked: true, text: "multiply" },
      { kind: "text", marked: true, text: " by " },
      { kind: "math", marked: true, text: "1.2" },
      { kind: "text", text: " first." },
    ]);
  });

  it("reads a quote copied with its list marker the way the list item shows", () => {
    const blocks = parseRichBlocks("Two rules:\n\n- Rises add.\n1. Falls **subtract**.");

    expect(markRichBlocks(blocks, "- Rises add.")[1]).toMatchObject({
      items: [[{ kind: "text", marked: true, text: "Rises add." }]],
    });

    expect(markRichBlocks(blocks, "1. Falls **subtract**.")[2]).toMatchObject({
      items: [
        [
          { kind: "text", marked: true, text: "Falls " },
          { kind: "bold", marked: true, text: "subtract" },
          { kind: "text", marked: true, text: "." },
        ],
      ],
    });
  });

  it("marks nothing when no line shows the quote or the quote cuts a mark in two", () => {
    const blocks = parseRichBlocks("A **bold** idea.\n\n- One item");

    expect(markRichBlocks(blocks, "Another idea.")).toStrictEqual(blocks);
    expect(markRichBlocks(blocks, "A **bold idea.")).toStrictEqual(blocks);

    expect(markRichBlocks(blocks, "One item")[1]).toStrictEqual({
      items: [[{ kind: "text", marked: true, text: "One item" }]],
      kind: "list",
      ordered: false,
    });
  });
});

describe("shared question math dialects", () => {
  it("keeps standard and over-escaped LaTeX distinct from currency and emphasis", () => {
    expect(
      parseRichInline(String.raw`**Compare** \(x^2\), \\(y^2\\) and $z^2$ for R$ 80.`),
    ).toStrictEqual([
      { kind: "bold", text: "Compare" },
      { kind: "text", text: " " },
      { kind: "math", text: "x^2" },
      { kind: "text", text: ", " },
      { kind: "math", text: "y^2" },
      { kind: "text", text: " and " },
      { kind: "math", text: "z^2" },
      { kind: "text", text: " for R$ 80." },
    ]);
  });
});
