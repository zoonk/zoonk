import { assert, constantFrom, property, string } from "fast-check";
import { describe, expect, it } from "vitest";
import {
  findCodeFenceLines,
  readCodeFence,
  readWholeCodeFence,
  removeCodeFences,
  splitAtCode,
} from "./code-fence";

const TEXT = [
  "O que aparece no console?",
  "```JavaScript linhas",
  "if (pronto) {",
  "  console.log('fim');",
  "}",
  "```",
  "Escolha uma opção.",
].join("\n");

describe(readCodeFence, () => {
  it("reads a fence's language and its code exactly as written", () => {
    expect(readCodeFence(TEXT.split("\n"), 1)).toStrictEqual({
      closed: true,
      code: "if (pronto) {\n  console.log('fim');\n}",
      end: 6,
      language: "javascript",
    });
  });

  it("runs a fence that never closes to the end, as CommonMark does", () => {
    expect(readCodeFence(["```", "x = 1", "", "y = 2"], 0)).toStrictEqual({
      closed: false,
      code: "x = 1\n\ny = 2",
      end: 4,
      language: null,
    });
  });

  it("closes only on a fence at least as long as the opening one", () => {
    expect(readCodeFence(["````md", "```", "texto", "````"], 0)?.code).toBe("```\ntexto");
  });

  it("reads inline code and an indented block as no fence", () => {
    expect(readCodeFence(["```x``` e mais"], 0)).toBeNull();
    expect(readCodeFence(["    ```", "x", "```"], 0)).toBeNull();
    expect(readCodeFence(TEXT.split("\n"), 2)).toBeNull();
  });
});

describe(findCodeFenceLines, () => {
  it("marks every line of each block, its fences included", () => {
    expect(findCodeFenceLines([...TEXT.split("\n"), "```sql", "SELECT 1;", "```"])).toStrictEqual(
      new Set([1, 2, 3, 4, 5, 7, 8, 9]),
    );
  });
});

describe(removeCodeFences, () => {
  it("keeps the prose around code", () => {
    expect(removeCodeFences(TEXT)).toBe("O que aparece no console?\nEscolha uma opção.");
  });
});

describe(splitAtCode, () => {
  it("cuts the text into prose, code blocks and inline code", () => {
    expect(splitAtCode("Rode `f()` assim:\n```js\nf();\n```\nPronto.")).toStrictEqual([
      { code: false, text: "Rode " },
      { code: true, text: "`f()`" },
      { code: false, text: " assim:\n" },
      { code: true, text: "```js\nf();\n```" },
      { code: false, text: "\nPronto." },
    ]);
  });

  it("joins back into any text", () => {
    const pieces = constantFrom("a", " ", "`", "```", "\n", "—");

    assert(
      property(string({ maxLength: 16, unit: pieces }), (text) => {
        expect(
          splitAtCode(text)
            .map((piece) => piece.text)
            .join(""),
        ).toBe(text);
      }),
    );
  });
});

describe(readWholeCodeFence, () => {
  it("reads a text that is one closed block and nothing else", () => {
    expect(readWholeCodeFence(" ```js\nf();\n```\n")?.code).toBe("f();");
    expect(readWholeCodeFence("Rode:\n```js\nf();\n```")).toBeNull();
    expect(readWholeCodeFence("```js\nf();\n```\nE depois?")).toBeNull();
    expect(readWholeCodeFence("```js\nf();")).toBeNull();
  });
});
