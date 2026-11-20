import { describe, expect, it } from "vitest";
import { type RichInlineSegment } from "./rich-inline-segments";
import {
  markRichBlocks,
  parseRichBlocks,
  parseRichInline,
  parseRichLine,
  readWholeCodeBlock,
} from "./rich-text-parser";

function words(value: string): RichInlineSegment[] {
  return [{ kind: "text", text: value }];
}

describe(parseRichInline, () => {
  it("keeps an English period and comma beside an inline code chip", () => {
    const segments = parseRichInline(
      "Write `Plants need water` . Then change `need` , not `water`.",
    );

    expect(segments.map(({ text }) => text).join("")).toBe(
      "Write Plants need water. Then change need, not water.",
    );
  });

  it("keeps French spacing after an inline code chip", () => {
    const segments = parseRichInline(
      "Que fait `print` ? Regardez `x` : la valeur de `y` ; essayez `z` !",
    );

    expect(segments.map(({ text }) => text).join("")).toBe(
      "Que fait print ? Regardez x : la valeur de y ; essayez z !",
    );
  });
});

describe(parseRichBlocks, () => {
  it("keeps a fenced block's code exactly as written, with its language", () => {
    const code = "for i in range(3):\n    if i > 0:\n\n        print(i)  \nprint('fim')";

    expect(
      parseRichBlocks(`Veja este código:\n\n\`\`\`python\n${code}\n\`\`\`\n\nO que ele mostra?`),
    ).toStrictEqual([
      { kind: "paragraph", lines: [words("Veja este código:")] },
      { code, kind: "code", language: "python" },
      { kind: "paragraph", lines: [words("O que ele mostra?")] },
    ]);
  });

  it("starts a block right under a sentence and reads Markdown inside it as code", () => {
    expect(
      parseRichBlocks("Em\n```\n- **x** | $y$\n| a | b |\n|---|---|\n```\no valor muda."),
    ).toStrictEqual([
      { kind: "paragraph", lines: [words("Em")] },
      { code: "- **x** | $y$\n| a | b |\n|---|---|", kind: "code", language: null },
      { kind: "paragraph", lines: [words("o valor muda.")] },
    ]);
  });

  it("runs a block that never closes to the end of the text", () => {
    expect(parseRichBlocks("Run it:\n```js\nconst a = 1;\n\nlog(a);")).toStrictEqual([
      { kind: "paragraph", lines: [words("Run it:")] },
      { code: "const a = 1;\n\nlog(a);", kind: "code", language: "js" },
    ]);
  });
});

describe(markRichBlocks, () => {
  it("never marks inside code, and marks the sentence after it", () => {
    const blocks = parseRichBlocks("```python\nprint('hi')\n```\nThe program prints hi.");

    expect(markRichBlocks(blocks, "prints hi")).toStrictEqual([
      { code: "print('hi')", kind: "code", language: "python" },
      {
        kind: "paragraph",
        lines: [
          [
            { kind: "text", text: "The program " },
            { kind: "text", marked: true, text: "prints hi" },
            { kind: "text", text: "." },
          ],
        ],
      },
    ]);
  });
});

describe(readWholeCodeBlock, () => {
  it("reads an answer that is one closed code block", () => {
    expect(readWholeCodeBlock("```java\nclass A {\n  int n;\n}\n```\n")).toStrictEqual({
      code: "class A {\n  int n;\n}",
      language: "java",
    });
  });

  it("leaves text with words around its code, or a block that never closes, to the text", () => {
    expect(readWholeCodeBlock("This one:\n```java\nclass A {}\n```")).toBeNull();
    expect(readWholeCodeBlock("```java\nclass A {}")).toBeNull();
    expect(readWholeCodeBlock("`class A {}`")).toBeNull();
  });
});

describe(parseRichLine, () => {
  it("reads a code block among words as one run of inline code", () => {
    expect(
      parseRichLine({
        parseProse: parseRichInline,
        text: "Use\n```python\nfor i in range(3):\n    print(i)\n```\nto count.",
      }),
    ).toStrictEqual([
      { kind: "text", text: "Use" },
      { kind: "text", text: " " },
      { kind: "code", text: "for i in range(3): print(i)" },
      { kind: "text", text: " " },
      { kind: "text", text: "to count." },
    ]);
  });

  it("reads text without code as its prose", () => {
    expect(parseRichLine({ parseProse: parseRichInline, text: "Pick `x`." })).toStrictEqual(
      parseRichInline("Pick `x`."),
    );
  });
});
