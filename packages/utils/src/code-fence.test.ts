import { assert, constantFrom, property, string } from "fast-check";
import { describe, expect, it } from "vitest";
import {
  editProse,
  findCodeFenceLines,
  readCodeFence,
  readWholeCodeFence,
  removeCode,
  removeCodeFences,
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

  it("reads a fence of tildes, which only tildes close, as CommonMark does", () => {
    expect(readCodeFence(["~~~js `x`", "f(`a`);", "```", "~~~~"], 0)).toStrictEqual({
      closed: true,
      code: "f(`a`);\n```",
      end: 4,
      language: "js",
    });

    expect(readCodeFence(["```", "x", "~~~"], 0)?.closed).toBe(false);
    expect(readCodeFence(["~~", "x", "~~"], 0)).toBeNull();
  });

  it("takes the opening fence's indentation off its code, as CommonMark does", () => {
    expect(readCodeFence(["  ```py", "  if x:", "      y()", " z", "  ```"], 0)?.code).toBe(
      "if x:\n    y()\nz",
    );
  });

  it("reads a fence on lines that end in a carriage return", () => {
    expect(readCodeFence(["```js\r", "f();\r", "```\r"], 0)).toMatchObject({
      closed: true,
      end: 3,
      language: "js",
    });
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

describe(removeCode, () => {
  it("leaves the prose, with a space where each block or inline code was", () => {
    expect(removeCode("Veja a imagem `abaixo`:\n~~~py\nprint('a imagem abaixo')\n~~~\nFim.")).toBe(
      "Veja a imagem  :\n \nFim.",
    );
  });
});

describe(editProse, () => {
  it("edits the prose between code blocks and inline code", () => {
    expect(
      editProse("Rode `f()` assim:\n```js\nf();\n```\nPronto.", (prose) => prose.toUpperCase()),
    ).toBe("RODE `f()` ASSIM:\n```js\nf();\n```\nPRONTO.");
  });

  it("ends a block at its closing fence in text with Windows line breaks", () => {
    expect(
      editProse("Rode:\r\n```js\r\nf();\r\n```\r\nPronto.", (prose) => prose.toUpperCase()),
    ).toBe("RODE:\r\n```js\r\nf();\r\n```\r\nPRONTO.");
  });

  it("rewrites the prose and keeps code as written", () => {
    expect(
      editProse("Use `<b>` em <b>negrito</b>:\n```html\n<b>oi</b>\n```", (prose) =>
        prose.replaceAll(/<\/?b>/gu, ""),
      ),
    ).toBe("Use `<b>` em negrito:\n```html\n<b>oi</b>\n```");
  });

  it("lets an edit read the sentence around code whole", () => {
    expect(
      editProse("[a função `f`](https://x.y) — veja", (prose) =>
        prose.replaceAll(/\[(?<text>[^\]]+)\]\([^)]+\)/gu, "$<text>").replaceAll(" —", ","),
      ),
    ).toBe("a função `f`, veja");
  });

  it("keeps any text whole when the edit changes nothing", () => {
    const pieces = constantFrom("a", " ", "`", "```", "~~~", "\n", "\r\n", "—");

    assert(
      property(string({ maxLength: 16, unit: pieces }), (text) => {
        expect(editProse(text, (prose) => prose)).toBe(text);
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
