import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import {
  findChoiceOption,
  findPartAreas,
  listChoiceGroups,
  listCountedSubjects,
  listExamChoiceViews,
  listUnchosenSubjects,
  readExamChoices,
  toChosenStructure,
} from "./exam-choices";

const citation = { passage: "…", sourceId: "notice" };
const LANGUAGES = "Linguagens, Códigos e suas Tecnologias";
const FOREIGN = "Língua Estrangeira";

function subject(name: string, questions: number | null, extra: object = {}) {
  return { citation, name, questions, topics: [], weight: null, ...extra };
}

const enem: ExamStructure = {
  formats: [{ citation, description: "Cinco alternativas", kind: "multipleChoice", options: 5 }],
  mock: null,
  rules: [],
  subjects: [
    subject(LANGUAGES, 45),
    subject("Língua Inglesa", 5, { choiceGroup: FOREIGN, partOf: LANGUAGES, shortName: "Inglês" }),
    subject("Língua Espanhola", 5, { choiceGroup: FOREIGN, partOf: LANGUAGES }),
    subject("Matemática e suas Tecnologias", 45),
  ],
};

const SPANISH = { group: FOREIGN, subject: "Língua Espanhola" };
const spanish = [SPANISH];

function names(structure: ExamStructure) {
  return structure.subjects.map((item) => [item.name, item.questions]);
}

describe(listChoiceGroups, () => {
  it("lists each choice with its options in the notice's order", () => {
    expect(
      listChoiceGroups(enem.subjects).map((group) => [
        group.name,
        group.options.map((option) => option.name),
      ]),
    ).toStrictEqual([[FOREIGN, ["Língua Inglesa", "Língua Espanhola"]]]);
  });

  it("has no choice when only one subject names it: one option is no choice", () => {
    const single = enem.subjects.filter((item) => item.name !== "Língua Espanhola");
    expect(listChoiceGroups(single)).toStrictEqual([]);
  });
});

describe(listUnchosenSubjects, () => {
  it("leaves every option out until the learner picks one", () => {
    expect([...listUnchosenSubjects({ choices: [], structure: enem })]).toStrictEqual([
      "Língua Inglesa",
      "Língua Espanhola",
    ]);
  });

  it("keeps only the picked option", () => {
    expect([...listUnchosenSubjects({ choices: spanish, structure: enem })]).toStrictEqual([
      "Língua Inglesa",
    ]);
  });

  it("reads a pick the notice no longer lists as no pick", () => {
    const stale = [{ group: FOREIGN, subject: "Língua Francesa" }];

    expect(listUnchosenSubjects({ choices: stale, structure: enem }).size).toBe(2);
  });
});

describe(toChosenStructure, () => {
  it("is the exam as the learner takes it: the picked option, counted inside its subject once", () => {
    expect(names(toChosenStructure({ choices: spanish, structure: enem }))).toStrictEqual([
      [LANGUAGES, 40],
      ["Língua Espanhola", 5],
      ["Matemática e suas Tecnologias", 45],
    ]);
  });

  it("keeps the subject an option is part of whole while nothing is picked", () => {
    expect(names(toChosenStructure({ choices: [], structure: enem }))).toStrictEqual([
      [LANGUAGES, 45],
      ["Matemática e suas Tecnologias", 45],
    ]);
  });

  it("leaves an exam without choices as it is", () => {
    const plain = { ...enem, subjects: [subject("Matemática", 45)] };
    expect(toChosenStructure({ choices: spanish, structure: plain })).toStrictEqual(plain);
  });

  it("takes an option's count from the latest edition when the notice gives none", () => {
    const past: ExamStructure = {
      ...enem,
      pastQuestions: {
        checkedAt: "2026-10-01T00:00:00.000Z",
        edition: "2025",
        source: null,
        subjects: [{ name: "Língua Espanhola", questions: 5 }],
      },
      subjects: enem.subjects.map((item) =>
        item.choiceGroup ? { ...item, questions: null } : item,
      ),
    };

    expect(names(toChosenStructure({ choices: spanish, structure: past }))).toStrictEqual([
      [LANGUAGES, 40],
      ["Língua Espanhola", null],
      ["Matemática e suas Tecnologias", 45],
    ]);
  });
});

describe(listCountedSubjects, () => {
  it("counts a choice once and an option inside another subject not at all", () => {
    expect(listCountedSubjects(enem.subjects).map((item) => item.name)).toStrictEqual([
      LANGUAGES,
      "Matemática e suas Tecnologias",
    ]);
  });

  it("counts a choice of separate tests once, by its first option", () => {
    const electives = [
      subject("Korean", 45),
      subject("Physics I", 20, { choiceGroup: "Science elective" }),
      subject("Chemistry I", 20, { choiceGroup: "Science elective" }),
    ];

    expect(listCountedSubjects(electives).map((item) => item.name)).toStrictEqual([
      "Korean",
      "Physics I",
    ]);
  });
});

describe(findChoiceOption, () => {
  it("finds an option of the named choice only", () => {
    expect(findChoiceOption({ choice: SPANISH, structure: enem })?.name).toBe("Língua Espanhola");

    expect(
      findChoiceOption({ choice: { group: FOREIGN, subject: LANGUAGES }, structure: enem }),
    ).toBeNull();
  });
});

describe(listExamChoiceViews, () => {
  it("shows each choice's options and the learner's pick, none while unpicked", () => {
    expect(listExamChoiceViews({ choices: spanish, structure: enem })).toStrictEqual([
      {
        group: FOREIGN,
        options: [
          { name: "Língua Inglesa", shortName: "Inglês" },
          { name: "Língua Espanhola", shortName: null },
        ],
        subject: "Língua Espanhola",
      },
    ]);

    expect(listExamChoiceViews({ choices: [], structure: enem })[0]?.subject).toBeNull();
  });
});

describe(readExamChoices, () => {
  it("reads the plan's stored picks, and none from settings without them", () => {
    expect(readExamChoices({ examChoices: spanish, focusAreas: [] })).toStrictEqual(spanish);
    expect(readExamChoices({ focusAreas: [] })).toStrictEqual([]);
    expect(readExamChoices({ examChoices: "broken" })).toStrictEqual([]);
    expect(readExamChoices(null)).toStrictEqual([]);
  });
});

describe(findPartAreas, () => {
  it("names the area of the subject an option's area is counted in, as graphs name them", () => {
    const areas = ["Linguagens", "Língua Inglesa", "Matemática"];

    expect(findPartAreas({ areas, structure: enem })).toStrictEqual(
      new Map([["Língua Inglesa", "Linguagens"]]),
    );

    expect(
      findPartAreas({ areas: ["Língua Inglesa", "Matemática"], structure: enem }),
    ).toStrictEqual(new Map());
  });
});
