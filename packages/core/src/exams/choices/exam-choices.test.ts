import { describe, expect, it } from "vitest";
import { type ExamStructure, examStructureSchema } from "../../library/exams/blueprint-contract";
import {
  BIOLOGY,
  CHEMISTRY,
  EXANI_STRUCTURE,
  LAW,
  MODULES,
  PREMED,
} from "./_test-utils/choice-blueprint";
import { listChoiceGroups, listCountedSubjects } from "./choice-groups";
import {
  findChosenOptions,
  findPartAreas,
  listUnchosenSubjects,
  readExamPicks,
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

const SPANISH = { group: FOREIGN, subjects: ["Língua Espanhola"] };
const spanish = [SPANISH];

function names(structure: ExamStructure) {
  return structure.subjects.map((item) => [item.name, item.questions]);
}

describe(listChoiceGroups, () => {
  it("lists each choice with its options in the notice's order", () => {
    expect(
      listChoiceGroups(enem).map((group) => [
        group.name,
        group.options.map((option) => option.name),
      ]),
    ).toStrictEqual([[FOREIGN, ["Língua Inglesa", "Língua Espanhola"]]]);
  });

  it("has no choice when only one subject names it: one option is no choice", () => {
    const single = enem.subjects.filter((item) => item.name !== "Língua Espanhola");
    expect(listChoiceGroups({ subjects: single })).toStrictEqual([]);
  });
});

describe(listUnchosenSubjects, () => {
  it("leaves every option out until the learner picks one", () => {
    expect([
      ...listUnchosenSubjects({ picks: { examChoices: [], examSubjects: [] }, structure: enem }),
    ]).toStrictEqual(["Língua Inglesa", "Língua Espanhola"]);
  });

  it("keeps only the picked option", () => {
    expect([
      ...listUnchosenSubjects({
        picks: { examChoices: spanish, examSubjects: [] },
        structure: enem,
      }),
    ]).toStrictEqual(["Língua Inglesa"]);
  });

  it("reads a pick the notice no longer lists as no pick", () => {
    const stale = [{ group: FOREIGN, subjects: ["Língua Francesa"] }];

    expect(
      listUnchosenSubjects({ picks: { examChoices: stale, examSubjects: [] }, structure: enem })
        .size,
    ).toBe(2);
  });
});

describe(toChosenStructure, () => {
  it("is the exam as the learner takes it: the picked option, counted inside its subject once", () => {
    expect(
      names(
        toChosenStructure({ picks: { examChoices: spanish, examSubjects: [] }, structure: enem }),
      ),
    ).toStrictEqual([
      [LANGUAGES, 40],
      ["Língua Espanhola", 5],
      ["Matemática e suas Tecnologias", 45],
    ]);
  });

  it("keeps the subject an option is part of whole while nothing is picked", () => {
    expect(
      names(toChosenStructure({ picks: { examChoices: [], examSubjects: [] }, structure: enem })),
    ).toStrictEqual([
      [LANGUAGES, 45],
      ["Matemática e suas Tecnologias", 45],
    ]);
  });

  it("leaves an exam without choices as it is", () => {
    const plain = { ...enem, subjects: [subject("Matemática", 45)] };

    expect(
      toChosenStructure({ picks: { examChoices: spanish, examSubjects: [] }, structure: plain }),
    ).toStrictEqual(plain);
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

    expect(
      names(
        toChosenStructure({ picks: { examChoices: spanish, examSubjects: [] }, structure: past }),
      ),
    ).toStrictEqual([
      [LANGUAGES, 40],
      ["Língua Espanhola", null],
      ["Matemática e suas Tecnologias", 45],
    ]);
  });
});

describe(listCountedSubjects, () => {
  it("counts a choice once and an option inside another subject not at all", () => {
    expect(listCountedSubjects(enem).map((item) => item.name)).toStrictEqual([
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

    expect(listCountedSubjects({ subjects: electives }).map((item) => item.name)).toStrictEqual([
      "Korean",
      "Physics I",
    ]);
  });
});

const EXANI = examStructureSchema.parse(EXANI_STRUCTURE);

function modules(subjects: string[]) {
  return (
    findChosenOptions({ choice: { group: MODULES, subjects }, structure: EXANI })?.map(
      (item) => item.name,
    ) ?? null
  );
}

describe(findChosenOptions, () => {
  it("finds the options of the named choice only", () => {
    expect(
      findChosenOptions({ choice: SPANISH, structure: enem })?.map((item) => item.name),
    ).toStrictEqual(["Língua Espanhola"]);

    expect(
      findChosenOptions({ choice: { group: FOREIGN, subjects: [LANGUAGES] }, structure: enem }),
    ).toBeNull();
  });

  it("takes up to as many options as candidates take, in the notice's order", () => {
    expect(modules([CHEMISTRY, BIOLOGY])).toStrictEqual([BIOLOGY, CHEMISTRY]);
    expect(modules([PREMED])).toStrictEqual([PREMED]);
    expect(modules([BIOLOGY, CHEMISTRY, LAW])).toBeNull();
    expect(modules([BIOLOGY, "Medicina"])).toBeNull();
  });
});

describe("an exam whose candidates take two of its modules", () => {
  it("lists the modules as one choice that takes two", () => {
    expect(listChoiceGroups(EXANI).map((group) => [group.name, group.take])).toStrictEqual([
      [MODULES, 2],
    ]);
  });

  it("counts two modules toward the exam, and has no choice when two modules are all it lists", () => {
    expect(listCountedSubjects(EXANI).map((item) => item.name)).toStrictEqual([
      BIOLOGY,
      LAW,
      "Comprensión lectora",
      "Redacción indirecta",
      "Pensamiento matemático",
    ]);

    const two = EXANI.subjects.filter(
      (item) => item.choiceGroup !== MODULES || [BIOLOGY, CHEMISTRY].includes(item.name),
    );

    expect(listChoiceGroups({ ...EXANI, subjects: two })).toStrictEqual([]);
  });

  it("is the exam with the picked modules only", () => {
    const picks = {
      examChoices: [{ group: MODULES, subjects: [BIOLOGY, CHEMISTRY] }],
      examSubjects: [],
    };

    expect(names(toChosenStructure({ picks, structure: EXANI }))).toStrictEqual([
      [BIOLOGY, 24],
      [CHEMISTRY, 24],
      ["Comprensión lectora", 30],
      ["Redacción indirecta", 30],
      ["Pensamiento matemático", 30],
    ]);
  });
});

describe(readExamPicks, () => {
  it("reads the plan's stored picks, and none from settings without them", () => {
    expect(readExamPicks({ examChoices: spanish, examSubjects: ["Matemática"] })).toStrictEqual({
      examChoices: spanish,
      examSubjects: ["Matemática"],
    });

    expect(readExamPicks({ focusAreas: [] })).toStrictEqual({ examChoices: [], examSubjects: [] });

    expect(readExamPicks({ examChoices: "broken" })).toStrictEqual({
      examChoices: [],
      examSubjects: [],
    });

    expect(readExamPicks(null)).toStrictEqual({ examChoices: [], examSubjects: [] });
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
