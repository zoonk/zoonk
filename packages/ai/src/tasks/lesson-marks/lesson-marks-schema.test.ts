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

describe(normalizeLessonMarks, () => {
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
