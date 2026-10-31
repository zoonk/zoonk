import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { listMockOptions } from "./mock-options";
import { listLeftOutChoices, listUnpickedChoices } from "./mock-unpicked";

const citation = { passage: "", sourceId: "notice" };
const LANGUAGES = "Linguagens, Códigos e suas Tecnologias";
const FOREIGN = "Língua Estrangeira";

function subject(name: string, questions: number, extra: object = {}) {
  return { citation, name, questions, topics: [], weight: null, ...extra };
}

const ENEM: ExamStructure = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "itemResponseTheory" },
    sections: [
      { day: 1, kind: "objective", minutes: 330, name: LANGUAGES, questions: 45 },
      {
        day: 2,
        kind: "objective",
        minutes: 300,
        name: "Matemática e suas Tecnologias",
        questions: 45,
      },
    ],
    timeLimitMinutes: null,
    totalQuestions: 90,
  },
  rules: [],
  subjects: [
    subject(LANGUAGES, 45),
    subject("Língua Inglesa", 5, { choiceGroup: FOREIGN, partOf: LANGUAGES }),
    subject("Língua Espanhola", 5, { choiceGroup: FOREIGN, partOf: LANGUAGES }),
    subject("Matemática e suas Tecnologias", 45),
  ],
};

describe(listUnpickedChoices, () => {
  it("places a choice on the day its options' subject is asked", () => {
    expect(listUnpickedChoices({ choices: [], structure: ENEM })).toStrictEqual([
      { days: [1], name: FOREIGN },
    ]);
  });

  it("lists nothing once the learner picks", () => {
    const choices = [{ group: FOREIGN, subject: "Língua Inglesa" }];
    expect(listUnpickedChoices({ choices, structure: ENEM })).toStrictEqual([]);
  });
});

describe(listLeftOutChoices, () => {
  const unpicked = [
    { days: [1], name: FOREIGN },
    { days: [], name: "Conhecimentos específicos (P3)" },
  ];

  it("leaves a choice out of its own day only, and one of unknown day out of every day", () => {
    expect(listLeftOutChoices({ day: 1, kind: "full", unpicked })).toStrictEqual([
      FOREIGN,
      "Conhecimentos específicos (P3)",
    ]);

    expect(listLeftOutChoices({ day: 2, kind: "half", unpicked })).toStrictEqual([
      "Conhecimentos específicos (P3)",
    ]);
  });

  it("leaves nothing out of a one-subject mock", () => {
    expect(listLeftOutChoices({ day: 1, kind: "area", unpicked })).toStrictEqual([]);
  });
});

describe("day mocks of an exam with an unpicked choice", () => {
  it("say only the choice's own day leaves it out", () => {
    const options = listMockOptions({
      dayInTurn: 1,
      goalAreas: [LANGUAGES, "Matemática e suas Tecnologias"],
      structure: ENEM,
      unpicked: listUnpickedChoices({ choices: [], structure: ENEM }),
    });

    const fullDays = options.flatMap((option) =>
      option.kind === "full"
        ? [[option.day, option.leftOut.filter((part) => part.part === "choice")]]
        : [],
    );

    expect(fullDays).toStrictEqual([
      [1, [{ name: FOREIGN, part: "choice" }]],
      [2, []],
    ]);
  });
});
