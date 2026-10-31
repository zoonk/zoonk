import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import {
  findChoiceOption,
  findNamedOption,
  findPartAreas,
  listChoiceGroups,
  listCountedSubjects,
  listExamChoiceViews,
  listUnchosenSubjects,
  listUnpickedLeftOut,
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

describe(findNamedOption, () => {
  const specialties = [
    { name: "Auditoria", shortName: "Auditoria" },
    { name: "Tecnologia da Informação – Ciência de Dados", shortName: "Ciência de Dados" },
    { name: "Tecnologia da Informação – Infraestrutura de TI", shortName: "Infraestrutura de TI" },
    { name: "Tecnologia da Informação – Desenvolvimento de Sistemas", shortName: null },
  ];

  const named = (...words: string[]) => findNamedOption({ options: specialties, words });

  it("names the option a word of the learner's is only in", () => {
    expect(named("concurso da CGU para TI, desenvolvimento")).toBe(
      "Tecnologia da Informação – Desenvolvimento de Sistemas",
    );

    expect(named("passar na CGU", "Auditor de ciência de dados")).toBe(
      "Tecnologia da Informação – Ciência de Dados",
    );
  });

  it("names none from words the options share, an acronym, or a word one only starts with", () => {
    expect(named("CGU, tecnologia da informação")).toBeNull();
    expect(named("CGU, auditor de TI")).toBeNull();
    expect(named("passar no concurso da CGU 2026 para auditor")).toBeNull();
  });

  it("names none when the words name two options", () => {
    expect(named("CGU auditoria ou desenvolvimento")).toBeNull();
  });
});

describe(listExamChoiceViews, () => {
  it("shows each choice's options and the learner's pick, none while unpicked", () => {
    expect(listExamChoiceViews({ choices: spanish, structure: enem })).toStrictEqual([
      {
        group: FOREIGN,
        leftOut: { examQuestions: null, name: FOREIGN, questions: 5 },
        options: [
          { name: "Língua Inglesa", shortName: "Inglês" },
          { name: "Língua Espanhola", shortName: null },
        ],
        subject: "Língua Espanhola",
      },
    ]);

    expect(listExamChoiceViews({ choices: [], structure: enem })[0]?.subject).toBeNull();
  });

  it("names the test a choice's options make up as what an unpicked choice leaves out", () => {
    const specialty = (name: string) =>
      subject(name, 90, { choiceGroup: "Especialidade", group: "Conhecimentos específicos (P3)" });

    const cgu: ExamStructure = {
      ...enem,
      mock: {
        adaptive: false,
        citations: [],
        order: null,
        scoring: { description: "", method: "wrongCancelsRight" },
        sections: [],
        timeLimitMinutes: null,
        totalQuestions: 170,
      },
      subjects: [
        subject("Ética Pública", null, { group: "Conhecimentos básicos (P1)" }),
        specialty("Auditoria"),
        specialty("Tecnologia da Informação – Desenvolvimento de Sistemas"),
      ],
    };

    expect(listExamChoiceViews({ choices: [], structure: cgu })[0]?.leftOut).toStrictEqual({
      examQuestions: 170,
      name: "Conhecimentos específicos (P3)",
      questions: 90,
    });

    expect(listUnpickedLeftOut({ choices: [], structure: cgu })).toStrictEqual([
      "Conhecimentos específicos (P3)",
    ]);
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
