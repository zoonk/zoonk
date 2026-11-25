import { describe, expect, it } from "vitest";
import { type MarksScreen, normalizeLessonMarks } from "./lesson-marks-schema";

const explanation: MarksScreen = {
  hasVisual: false,
  kind: "explanation",
  text: "O **ativo** é tudo o que a empresa tem. A padaria do João tem um forno e R$ 2.000 no caixa.",
  title: "O que a empresa tem",
};

const pictured: MarksScreen = { ...explanation, hasVisual: true };

const workedExample: MarksScreen = {
  hasVisual: false,
  kind: "workedExample",
  text: "A padaria comprou farinha a prazo. O que muda no balanço?",
  title: "Somando o ativo",
};

const question: MarksScreen = {
  hasVisual: true,
  kind: "question",
  text: "O forno é um ativo da padaria?",
  title: null,
};

const ideas = [
  { label: "Ativo", text: "Ativo é tudo o que a empresa tem." },
  { label: "Passivo", text: "Passivo é tudo o que a empresa deve." },
];

const stamp = { description: "A wooden rubber stamp", name: "Rubber Stamp", searchWords: ["seal"] };
const oven = { description: "A bakery's brick oven", name: "brick oven", searchWords: ["bakery"] };

function exampleOf({ example, text }: { example: string; text: string }) {
  return normalizeLessonMarks({
    ideas: [],
    output: {
      ideas: [],
      screens: [{ example, icon: null, idea: null, screen: 1, underline: null }],
    },
    screens: [{ ...explanation, text }],
  }).screens[0]?.example;
}

describe(normalizeLessonMarks, () => {
  it("keeps an about line whole past its target, so the lesson's map still shows", () => {
    const about =
      "O que entra no ativo de uma empresa quando ela compra à vista e também a prazo agora";

    const marks = normalizeLessonMarks({
      ideas,
      output: { ideas: [{ about, icon: null, idea: 1 }], screens: [] },
      screens: [explanation],
    });

    expect(marks.ideas[0]?.about).toBe(about);
  });

  it("keeps exact quotes, ideas as indexes from 0 and icons only where a screen may show one", () => {
    const marks = normalizeLessonMarks({
      ideas,
      output: {
        ideas: [
          { about: "O que entra no ativo de uma empresa", icon: stamp, idea: 1 },
          { about: "O que a empresa deve", icon: null, idea: 2 },
        ],
        screens: [
          {
            example: "A padaria do João tem um forno e R$ 2.000 no caixa.",
            icon: oven,
            idea: 1,
            screen: 1,
            underline: "tudo o que a empresa tem",
          },
          { example: null, icon: oven, idea: 1, screen: 2, underline: null },
          { example: null, icon: stamp, idea: 2, screen: 3, underline: "O que muda no balanço?" },
          { example: null, icon: stamp, idea: 2, screen: 4, underline: "O forno" },
        ],
      },
      screens: [explanation, pictured, workedExample, question],
    });

    const need = {
      description: "A wooden rubber stamp",
      name: "rubber stamp",
      searchWords: ["seal"],
    };

    expect(marks).toStrictEqual({
      ideas: [
        { about: "O que entra no ativo de uma empresa", icon: need },
        { about: "O que a empresa deve", icon: null },
      ],
      screens: [
        {
          example: "A padaria do João tem um forno e R$ 2.000 no caixa.",
          icon: oven,
          ideaIndex: 0,
          underline: "tudo o que a empresa tem",
        },
        { example: null, icon: null, ideaIndex: 0, underline: null },
        { example: null, icon: null, ideaIndex: 1, underline: "O que muda no balanço?" },
        { example: null, icon: null, ideaIndex: 1, underline: null },
      ],
    });
  });

  it("frames a numbered item with its number when the quote leaves the number out", () => {
    const steps: MarksScreen = {
      ...explanation,
      text: "Para fechar o caixa:\n\n1. Conte o dinheiro.\n2. Some R$ 2.000 do caixa e o forno.\n3. Anote o total.",
    };

    const marks = normalizeLessonMarks({
      ideas,
      output: {
        ideas: [],
        screens: [
          {
            example: "Some R$ 2.000 do caixa e o forno.",
            icon: null,
            idea: 0,
            screen: 1,
            underline: null,
          },
        ],
      },
      screens: [steps],
    });

    expect(marks.screens[0]?.example).toBe("2. Some R$ 2.000 do caixa e o forno.");
  });

  describe("a screen with a code block", () => {
    const program: MarksScreen = {
      ...pictured,
      text: [
        "Observe esta classe:",
        "",
        "```java",
        "class Pedido {",
        "    Pedido(int codigo) {}",
        "}",
        "```",
        "",
        "A expressão `new Pedido(31)` executa `Pedido(int codigo)` com 31. Essa rotina tem o nome da classe. Ela se chama **construtor**.",
      ].join("\n"),
    };

    const block = "```java\nclass Pedido {\n    Pedido(int codigo) {}\n}\n```";
    const trace = "A expressão `new Pedido(31)` executa `Pedido(int codigo)` com 31.";

    function exampleFor({ example, screen = program }: { example: string; screen?: MarksScreen }) {
      const marks = normalizeLessonMarks({
        ideas,
        output: {
          ideas: [],
          screens: [{ example, icon: null, idea: 1, screen: 1, underline: null }],
        },
        screens: [screen],
      });

      return marks.screens[0]?.example;
    }

    it("keeps the block with the sentence that traces it when the quote loses the blank line between them", () => {
      expect(exampleFor({ example: `${block}\n${trace}` })).toBe(`${block}\n\n${trace}`);
    });

    it("frames the block a sentence traces with it, so the program never sits outside the frame", () => {
      expect(exampleFor({ example: trace })).toBe(`${block}\n\n${trace}`);
    });

    it("frames the block a sentence introduces with it", () => {
      const introduced: MarksScreen = {
        ...program,
        text: `Um construtor roda quando o objeto nasce. Neste código, ele roda com 31:\n\n${block}`,
      };

      expect(exampleFor({ example: "Neste código, ele roda com 31:", screen: introduced })).toBe(
        `Neste código, ele roda com 31:\n\n${block}`,
      );
    });

    it("frames the text's order when the quote puts the block before the sentence that introduces it", () => {
      const introduced: MarksScreen = {
        ...program,
        text: `Um construtor roda quando o objeto nasce. Neste código, ele roda com 31:\n\n${block}`,
      };

      expect(
        exampleFor({ example: `${block}\nNeste código, ele roda com 31:`, screen: introduced }),
      ).toBe(`Neste código, ele roda com 31:\n\n${block}`);
    });

    it("frames the text's own words when the quote drops their inline code and bold marks", () => {
      const marked: MarksScreen = {
        ...program,
        text: `${block}\n\nCom 31, o \`Pedido\` nasce **pronto**. Ela se chama **construtor**.`,
      };

      expect(
        exampleFor({ example: `${block}\n\nCom 31, o Pedido nasce pronto.`, screen: marked }),
      ).toBe(`${block}\n\nCom 31, o \`Pedido\` nasce **pronto**.`);
    });

    it("takes the intro beside the block when the text repeats it", () => {
      const twice: MarksScreen = {
        ...program,
        text: "Run this:\n\n```js\nf(1);\n```\n\nNow change the value. Run this:\n\n```js\nf(2);\n```",
      };

      expect(exampleFor({ example: "```js\nf(2);\n```\nRun this:", screen: twice })).toBe(
        "Run this:\n\n```js\nf(2);\n```",
      );
    });

    it("tells programs apart by their code's own stars", () => {
      const twoPrograms: MarksScreen = {
        ...program,
        text: "```js\nn ** 2\n```\n\nCheck the result.\n\n```js\nn * 2\n```\n\nCheck the result. Both are expressions.",
      };

      expect(
        exampleFor({ example: "```js\nn * 2\n```\nCheck the result.", screen: twoPrograms }),
      ).toBe("```js\nn * 2\n```\n\nCheck the result.");
    });

    it("finds the sentence in the prose when the code prints the same words without marks", () => {
      const echoed: MarksScreen = {
        ...program,
        text: '```js\nconsole.log("Use Foo.");\n```\n\nUse `Foo`. Then continue.',
      };

      expect(exampleFor({ example: "Use Foo.", screen: echoed })).toBe(
        '```js\nconsole.log("Use Foo.");\n```\n\nUse `Foo`.',
      );
    });

    it("keeps a frame around the block alone", () => {
      expect(exampleFor({ example: block })).toBe(block);
    });

    it("never adds another program to a quote that already holds its own", () => {
      const twoPrograms: MarksScreen = {
        ...program,
        text: "```js\nconsole.log(1);\n```\n\nThe second program prints two:\n\n```js\nconsole.log(2);\n```\n\nEach call prints its number.",
      };

      const second = "The second program prints two:\n\n```js\nconsole.log(2);\n```";

      expect(exampleFor({ example: second, screen: twoPrograms })).toBe(second);
    });

    it("finds the sentence after the block, not the same words inside the code", () => {
      const echoed: MarksScreen = {
        ...program,
        text: 'Run this:\n\n```js\nconsole.log("It prints two.");\n```\n\nIt prints two. A call prints its argument.',
      };

      expect(exampleFor({ example: "It prints two.", screen: echoed })).toBe(
        '```js\nconsole.log("It prints two.");\n```\n\nIt prints two.',
      );
    });

    it("frames an indented block, a full-width colon's block and a block with CRLF line breaks", () => {
      const indented: MarksScreen = {
        ...program,
        text: `Look:\n\n  ${block.replaceAll("\n", "\n  ")}\n\n${trace} The rule follows.`,
      };

      expect(exampleFor({ example: trace, screen: indented })).toBe(
        `${block.replaceAll("\n", "\n  ")}\n\n${trace}`,
      );

      const japanese: MarksScreen = {
        ...program,
        text: `コンストラクタは名前がクラスと同じです。このコードを見てください：\n\n${block}`,
      };

      expect(exampleFor({ example: "このコードを見てください：", screen: japanese })).toBe(
        `このコードを見てください：\n\n${block}`,
      );

      const crlf: MarksScreen = { ...program, text: program.text.replaceAll("\n", "\r\n") };

      expect(exampleFor({ example: `${block}\n${trace}`, screen: crlf })).toBe(
        `${block}\n\n${trace}`.replaceAll("\n", "\r\n"),
      );
    });
  });

  describe("an example copied without its bold marks", () => {
    it("frames the whole bold sentence, after an emoji too", () => {
      expect(exampleOf({ example: "Try it.", text: "A rule. **Try it.**" })).toBe("**Try it.**");

      expect(exampleOf({ example: "Ana tem pão.", text: "🍞 Uma regra. Ana tem **pão**." })).toBe(
        "Ana tem **pão**.",
      );
    });

    it("never takes the bold rest of a sentence for a sentence", () => {
      const text = "She whispered “Go.” **and left**. Another time she stayed.";
      expect(exampleOf({ example: "and left.", text })).toBeNull();
    });

    it("gives up at once on a long screen the copy doesn't match", () => {
      const text = Array.from({ length: 40 }, (_, at) => `A **bold** word ${at}.`).join(" ");
      const started = performance.now();

      expect(exampleOf({ example: `${text.replaceAll("**", "")} extra`, text })).toBeNull();
      expect(performance.now() - started).toBeLessThan(500);
    });
  });

  it("drops what the screens don't have: a changed word, half a sentence, the whole text, an idea past the map", () => {
    const marks = normalizeLessonMarks({
      ideas,
      output: {
        ideas: [],
        screens: [
          {
            example: "tem um forno e R$ 2.000 no caixa.",
            icon: null,
            idea: 3,
            screen: 1,
            underline: "tudo que a empresa tem",
          },
          { example: explanation.text, icon: null, idea: 0, screen: 2, underline: null },
          { example: null, icon: null, idea: 1, screen: 9, underline: null },
        ],
      },
      screens: [explanation, explanation],
    });

    expect(marks.screens).toStrictEqual([
      { example: null, icon: null, ideaIndex: null, underline: null },
      { example: null, icon: null, ideaIndex: null, underline: null },
    ]);

    expect(marks.ideas).toStrictEqual([
      { about: null, icon: null },
      { about: null, icon: null },
    ]);
  });

  it("keeps the ideas' icons apart and never puts a screen's idea icon beside its text", () => {
    const cell = { description: "A round animal cell", name: "cell", searchWords: [] };

    const marks = normalizeLessonMarks({
      ideas: [...ideas, { label: "Patrimônio", text: "Patrimônio é o ativo menos o passivo." }],
      output: {
        ideas: [
          { about: "O que a empresa tem", icon: cell, idea: 1 },
          { about: "O que a empresa deve", icon: stamp, idea: 2 },
          { about: "O que sobra", icon: { ...cell, name: "Cell" }, idea: 3 },
        ],
        screens: [
          { example: null, icon: cell, idea: 1, screen: 1, underline: null },
          { example: null, icon: oven, idea: 2, screen: 2, underline: null },
        ],
      },
      screens: [explanation, explanation],
    });

    expect(marks.ideas.map((idea) => idea.icon?.name ?? null)).toStrictEqual([
      "cell",
      "rubber stamp",
      null,
    ]);

    expect(marks.screens.map((screen) => screen.icon?.name ?? null)).toStrictEqual([
      null,
      "brick oven",
    ]);
  });

  describe("the strip never counts back", () => {
    const guess: MarksScreen = { ...question, kind: "guess" };

    const fourIdeas = ["Regras antigas", "Nuvem", "Elétron inteiro", "Estado fundamental"].map(
      (label) => ({ label, text: `${label} é uma ideia da aula.` }),
    );

    function tagIdeas({ ideaNumbers, screens }: { ideaNumbers: number[]; screens: MarksScreen[] }) {
      const marks = normalizeLessonMarks({
        ideas: fourIdeas,
        output: {
          ideas: [],
          screens: ideaNumbers.map((idea, index) => ({
            example: null,
            icon: null,
            idea,
            screen: index + 1,
            underline: null,
          })),
        },
        screens,
      });

      return marks.screens.map((screen) => screen.ideaIndex);
    }

    it("drops the idea of a screen that jumps ahead of ideas later screens teach", () => {
      const ideaIndexes = tagIdeas({
        ideaNumbers: [1, 4, 4, 2, 2, 3, 4, 4],
        screens: [
          explanation,
          guess,
          explanation,
          explanation,
          question,
          explanation,
          explanation,
          explanation,
        ],
      });

      expect(ideaIndexes).toStrictEqual([0, 3, null, 1, 1, 2, 3, 3]);
    });

    it("keeps the run that reaches every idea when a worked example goes back to an earlier one", () => {
      const ideaIndexes = tagIdeas({
        ideaNumbers: [1, 2, 2, 2, 3, 3, 3, 4, 3, 4],
        screens: [
          explanation,
          guess,
          explanation,
          explanation,
          explanation,
          explanation,
          explanation,
          explanation,
          workedExample,
          question,
        ],
      });

      expect(ideaIndexes).toStrictEqual([0, 1, 1, 1, 2, 2, 2, 3, null, 3]);
    });
  });

  it("repairs what code can: a bold wrap around the underline, stray marks and an em dash in an about line", () => {
    const marks = normalizeLessonMarks({
      ideas: [ideas[0] ?? { label: null, text: "" }],
      output: {
        ideas: [{ about: "O **ativo** — o que a empresa tem", icon: null, idea: 1 }],
        screens: [{ example: null, icon: null, idea: 1, screen: 1, underline: "**ativo**" }],
      },
      screens: [explanation],
    });

    expect(marks).toStrictEqual({
      ideas: [{ about: "O ativo, o que a empresa tem", icon: null }],
      screens: [{ example: null, icon: null, ideaIndex: 0, underline: "ativo" }],
    });
  });
});
