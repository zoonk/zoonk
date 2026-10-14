import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getMockFormatMix } from "./mock-format-mix";
import { planOptionMock } from "./mock-option-plan";
import { listMockOptions } from "./mock-options";
import { type MockCandidate, countPlannedQuestions } from "./mock-plan";
import { getMockQuestionsShortfall } from "./mock-shortfall";

const CITATION = { passage: "From the notice.", sourceId: "source" };

function subject(name: string, questions: number | null, shortName: string | null = null) {
  return { citation: CITATION, name, questions, shortName, topics: [], weight: null };
}

/** ENEM's shape: two days of 90 questions, the first with the essay as a written part. */
const TWO_DAYS: ExamStructure = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "itemResponseTheory" },
    sections: [
      { day: 1, minutes: 330, name: "Linguagens, Ciências Humanas e redação", questions: 90 },
      { day: 1, kind: "written", minutes: null, name: "Redação", questions: null },
      { day: 2, minutes: 300, name: "Ciências da Natureza e Matemática", questions: 90 },
    ],
    timeLimitMinutes: null,
    totalQuestions: 180,
  },
  rules: [],
  subjects: [
    subject("Linguagens, Códigos e suas Tecnologias", 45, "Linguagens"),
    subject("Ciências Humanas e suas Tecnologias", 45, "Ciências Humanas"),
    subject("Ciências da Natureza e suas Tecnologias", 45, "Ciências da Natureza"),
    subject("Matemática e suas Tecnologias", 45, "Matemática"),
    subject("Redação", null),
  ],
};

const GOAL_AREAS = ["Linguagens", "Ciências Humanas", "Ciências da Natureza", "Matemática"];

/** The OAB's first phase: one test of 80 questions, whose notice counts none of its subjects. */
const OAB: ExamStructure = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "raw" },
    sections: [{ day: null, minutes: 300, name: "Prova objetiva", questions: 80 }],
    timeLimitMinutes: 300,
    totalQuestions: 80,
  },
  rules: [],
  subjects: [
    subject("Direito Civil", null),
    subject("Direito Processual Civil", null, "Processo Civil"),
    subject("Direito da Criança e do Adolescente", null),
    subject(
      "Estatuto da Advocacia e da OAB, seu Regulamento Geral e Código de Ética e Disciplina da OAB",
      null,
      "Ética Profissional",
    ),
  ],
};

/** Sofia's plan, built before the notice was read: its areas go by the names learners use. */
const OAB_AREAS = [
  "Direito Civil",
  "Direito Processual Civil",
  "Estatuto da Criança e do Adolescente",
  "Ética Profissional",
];

function candidates(area: string, count: number): MockCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    answered: false,
    area,
    difficulty: null,
    itemId: `${area}-${index}`,
    skillId: `${area}-skill-${index % 3}`,
  }));
}

describe(listMockOptions, () => {
  it("offers each exam day in full, half of the day in turn and each objective subject", () => {
    const options = listMockOptions({ dayInTurn: 2, goalAreas: GOAL_AREAS, structure: TWO_DAYS });

    expect(
      options.map(({ area, day, kind, minutes, questions }) => ({
        area,
        day,
        kind,
        minutes,
        questions,
      })),
    ).toStrictEqual([
      { area: null, day: 1, kind: "full", minutes: 330, questions: 90 },
      { area: null, day: 2, kind: "full", minutes: 300, questions: 90 },
      { area: null, day: 2, kind: "half", minutes: 150, questions: 45 },
      {
        area: "Linguagens, Códigos e suas Tecnologias",
        day: null,
        kind: "area",
        minutes: 165,
        questions: 45,
      },
      {
        area: "Ciências Humanas e suas Tecnologias",
        day: null,
        kind: "area",
        minutes: 165,
        questions: 45,
      },
      {
        area: "Ciências da Natureza e suas Tecnologias",
        day: null,
        kind: "area",
        minutes: 150,
        questions: 45,
      },
      {
        area: "Matemática e suas Tecnologias",
        day: null,
        kind: "area",
        minutes: 150,
        questions: 45,
      },
    ]);
  });

  it("names each day's subjects and says when it leaves the written part out", () => {
    const [first, second] = listMockOptions({
      dayInTurn: 1,
      goalAreas: GOAL_AREAS,
      structure: TWO_DAYS,
    });

    expect(first).toMatchObject({
      areas: ["Linguagens, Códigos e suas Tecnologias", "Ciências Humanas e suas Tecnologias"],
      objectiveOnly: true,
    });

    expect(second).toMatchObject({
      areas: ["Ciências da Natureza e suas Tecnologias", "Matemática e suas Tecnologias"],
      objectiveOnly: false,
    });
  });

  it("places each subject on the day whose section names part of its official name", () => {
    // A notice read without short names: ENEM's sections name its areas only in part.
    const official = {
      ...TWO_DAYS,
      subjects: TWO_DAYS.subjects.map((entry) => ({ ...entry, shortName: null })),
    };

    const options = listMockOptions({
      dayInTurn: 1,
      goalAreas: official.subjects.map((entry) => entry.name),
      structure: official,
    });

    const [first, second] = options;

    expect(first?.areas).toStrictEqual([
      "Linguagens, Códigos e suas Tecnologias",
      "Ciências Humanas e suas Tecnologias",
    ]);

    expect(second?.areas).toStrictEqual([
      "Ciências da Natureza e suas Tecnologias",
      "Matemática e suas Tecnologias",
    ]);

    // Each subject at its own day's pace: 330 minutes for 90 questions, then 300 for 90.
    expect(
      options.filter((option) => option.kind === "area").map((option) => option.minutes),
    ).toStrictEqual([165, 165, 150, 150]);
  });

  it("includes the written part in the full mock when the exam has essays for it", () => {
    const essays = [{ area: "Redação", itemId: "redacao" }];

    const [first, second, half] = listMockOptions({
      dayInTurn: 1,
      essays,
      goalAreas: GOAL_AREAS,
      structure: TWO_DAYS,
    });

    // ENEM's essay shares the first day's 330 minutes.
    expect(first).toMatchObject({ minutes: 330, objectiveOnly: false, written: ["Redação"] });
    expect(second).toMatchObject({ objectiveOnly: false, written: [] });
    expect(half).toMatchObject({ day: 1, kind: "half", objectiveOnly: true, written: [] });
  });

  it("offers a day that is all written as a full mock when the exam has its essays", () => {
    // The OAB's second phase: one written test of five hours, a legal brief and four discursive questions.
    const writtenOnly: ExamStructure = {
      ...OAB,
      mock: OAB.mock && {
        ...OAB.mock,
        sections: [
          {
            day: null,
            kind: "written",
            minutes: 300,
            name: "Prova prático-profissional",
            questions: null,
            tasks: [
              { count: 1, description: "peça profissional" },
              { count: 4, description: "questões discursivas" },
            ],
          },
        ],
        totalQuestions: null,
      },
      subjects: [subject("Direito Civil", null)],
    };

    const essays = Array.from({ length: 5 }, (_, index) => ({ area: null, itemId: `e${index}` }));

    expect(
      listMockOptions({
        dayInTurn: null,
        essays,
        goalAreas: ["Direito Civil"],
        structure: writtenOnly,
      }),
    ).toMatchObject([
      {
        kind: "full",
        minutes: 300,
        objectiveOnly: false,
        questions: 0,
        written: ["Prova prático-profissional"],
      },
    ]);

    // Without its essays yet, there's nothing to sit.
    expect(
      listMockOptions({ dayInTurn: null, goalAreas: ["Direito Civil"], structure: writtenOnly }),
    ).toStrictEqual([]);
  });

  it("knows the written part a day's section names, when the notice lists it only as a subject", () => {
    const sections = (TWO_DAYS.mock?.sections ?? []).filter(
      (section) => section.kind !== "written",
    );

    const mock = TWO_DAYS.mock && { ...TWO_DAYS.mock, sections };

    const [first, second] = listMockOptions({
      dayInTurn: 1,
      goalAreas: GOAL_AREAS,
      structure: { ...TWO_DAYS, mock },
    });

    expect(first?.objectiveOnly).toBe(true);
    expect(second?.objectiveOnly).toBe(false);
  });

  it("leaves out the subjects the plan doesn't study", () => {
    const options = listMockOptions({
      dayInTurn: null,
      goalAreas: ["Matemática", "Linguagens"],
      structure: { ...TWO_DAYS, subjects: [...TWO_DAYS.subjects, subject("Linguagens extra", 3)] },
    });

    expect(
      options.filter((option) => option.kind === "area").map((option) => option.areas),
    ).toStrictEqual([
      ["Linguagens, Códigos e suas Tecnologias"],
      ["Matemática e suas Tecnologias"],
    ]);
  });

  it("offers every subject the plan studies, whatever name the plan gives it", () => {
    const options = listMockOptions({ dayInTurn: null, goalAreas: OAB_AREAS, structure: OAB });

    // Named as the notice (and the Plan) names them, never by their short names.
    expect(
      options.filter((option) => option.kind === "area").map((option) => option.areas),
    ).toStrictEqual([
      ["Direito Civil"],
      ["Direito Processual Civil"],
      ["Direito da Criança e do Adolescente"],
      [
        "Estatuto da Advocacia e da OAB, seu Regulamento Geral e Código de Ética e Disciplina da OAB",
      ],
    ]);
  });

  it("sizes a subject's mock at its even share of the exam when nothing counts the subjects", () => {
    // The OAB's 80 questions over its four subjects here, when no edition counts them: 20 each.
    const options = listMockOptions({ dayInTurn: null, goalAreas: OAB_AREAS, structure: OAB });

    expect(
      options.filter((option) => option.kind === "area").map((option) => option.questions),
    ).toStrictEqual([20, 20, 20, 20]);

    const short = { ...OAB, mock: OAB.mock && { ...OAB.mock, sections: [], totalQuestions: 40 } };
    const fewer = listMockOptions({ dayInTurn: null, goalAreas: OAB_AREAS, structure: short });

    expect(fewer.find((option) => option.kind === "area")?.questions).toBe(10);
  });

  it("offers a subject the exam asks little of, at the fewest questions a subject's mock asks", () => {
    // The latest edition's counts: ethics 8 of 80, human rights 2.
    const counted: ExamStructure = {
      ...OAB,
      pastQuestions: {
        checkedAt: "2026-10-09T00:00:00.000Z",
        edition: null,
        source: { title: null, url: "https://example.com/oab" },
        subjects: [
          { name: "Direito Civil", questions: 6 },
          { name: "Direito Processual Civil", questions: 6 },
          { name: "Direito da Criança e do Adolescente", questions: 2 },
          { name: OAB.subjects[3]?.name ?? "", questions: 8 },
        ],
      },
    };

    const options = listMockOptions({ dayInTurn: null, goalAreas: OAB_AREAS, structure: counted });

    expect(
      options
        .filter((option) => option.kind === "area")
        .map(({ areas, questions }) => ({ areas, questions })),
    ).toStrictEqual([
      { areas: [OAB.subjects[3]?.name], questions: 8 },
      { areas: ["Direito Civil"], questions: 6 },
      { areas: ["Direito Processual Civil"], questions: 6 },
      { areas: ["Direito da Criança e do Adolescente"], questions: 5 },
    ]);
  });

  it("sizes a class test's mocks to the short test it copies", () => {
    const classTest: ExamStructure = {
      formats: [],
      mock: {
        adaptive: false,
        citations: [],
        order: null,
        scoring: { description: "", method: "raw" },
        sections: [],
        timeLimitMinutes: 30,
        totalQuestions: 10,
      },
      rules: [],
      subjects: [subject("Cell membrane", null)],
    };

    const options = listMockOptions({
      dayInTurn: null,
      goalAreas: ["Cell membrane"],
      structure: classTest,
    });

    expect(
      options.map(({ kind, minutes, questions }) => ({ kind, minutes, questions })),
    ).toStrictEqual([
      { kind: "full", minutes: 30, questions: 10 },
      { kind: "half", minutes: 15, questions: 5 },
    ]);
  });
});

describe("an exam with listening and speaking papers", () => {
  // IELTS as a notice reading can come back: each paper's time, no counts and no listening parts.
  const ielts: ExamStructure = {
    formats: [],
    mock: {
      adaptive: false,
      citations: [],
      order: null,
      scoring: { description: "", method: "other" },
      sections: [
        {
          day: null,
          kind: "listening",
          minutes: 30,
          name: "Listening",
          questions: null,
          tasks: [],
        },
        { day: null, kind: "objective", minutes: 60, name: "Reading", questions: null, tasks: [] },
        { day: null, kind: "written", minutes: 60, name: "Writing", questions: null, tasks: [] },
        {
          day: null,
          kind: "speaking",
          minutes: null,
          name: "Speaking",
          questions: null,
          tasks: [],
        },
      ],
      timeLimitMinutes: 165,
      totalQuestions: null,
    },
    rules: [],
    subjects: ["Listening", "Reading", "Writing", "Speaking"].map((name) => subject(name, null)),
  };

  const goalAreas = ["Listening", "Reading", "Writing", "Speaking"];

  it("offers no subject mock of written questions for a listening or a speaking paper", () => {
    const options = listMockOptions({ dayInTurn: null, goalAreas, structure: ielts });

    expect(options.filter((option) => option.kind === "area")).toStrictEqual([]);
  });

  it("sizes each paper as the mock sits it: a listening section by its recordings, each on the notice's time", () => {
    const [full] = listMockOptions({
      dayInTurn: null,
      goalAreas,
      listening: new Set(["Listening"]),
      structure: ielts,
    });

    // One recording of six questions in the Listening paper's 30 minutes, and the default 45
    // Reading questions in its 60.
    expect(full).toMatchObject({ kind: "full", minutes: 90, questions: 51 });
  });

  it("names the papers a mock covers when it leaves one out that isn't a written part", () => {
    const [full, half] = listMockOptions({
      dayInTurn: null,
      goalAreas,
      listening: new Set(["Listening"]),
      structure: ielts,
    });

    // Speaking isn't sat, and Writing has no essay yet: Listening and Reading are what it covers,
    // in full or in half.
    expect(full?.covers).toStrictEqual(["Listening", "Reading"]);
    expect(half?.covers).toStrictEqual(["Listening", "Reading"]);

    // Without recordings yet, Reading alone.
    const [unvoiced] = listMockOptions({ dayInTurn: null, goalAreas, structure: ielts });
    expect(unvoiced?.covers).toStrictEqual(["Reading"]);
  });

  it("names none when the mock sits every paper but the written ones", () => {
    const objective = {
      ...ielts,
      mock: ielts.mock && {
        ...ielts.mock,
        sections: ielts.mock.sections.filter((section) => section.kind !== "speaking"),
      },
    };

    const [full] = listMockOptions({
      dayInTurn: null,
      goalAreas,
      listening: new Set(["Listening"]),
      structure: objective,
    });

    expect(full?.covers).toBeNull();
  });
});

describe(planOptionMock, () => {
  it("asks each subject as its own block, in the notice's order and evenly, when the notice gives no counts", () => {
    // The Câmara's notice gives 180 items over its subjects without saying how many each.
    const subjects = ["Língua Portuguesa", "Direito Constitucional", "Processo Legislativo"];

    const camara: ExamStructure = {
      ...OAB,
      mock: OAB.mock && {
        ...OAB.mock,
        sections: [{ day: null, minutes: 300, name: "Provas objetivas", questions: 30 }],
        timeLimitMinutes: 300,
        totalQuestions: 30,
      },
      subjects: subjects.map((name) => subject(name, null)),
    };

    const bank = subjects.flatMap((name) =>
      Array.from({ length: 20 }, (_, index) => ({
        answered: false,
        area: name,
        difficulty: null,
        itemId: `${name}#${index}`,
        skillId: `${name}-skill-${index % 3}`,
      })),
    );

    const [full] = listMockOptions({ dayInTurn: null, goalAreas: subjects, structure: camara });

    const plan = full
      ? planOptionMock({ candidates: bank, option: full, structure: camara })
      : null;

    const asked = (plan?.sections[0]?.itemIds ?? []).map((id) => id.split("#")[0]);

    // Ten of each, one subject after the other, never mixed.
    expect(asked).toStrictEqual(subjects.flatMap((name) => Array.from({ length: 10 }, () => name)));
  });

  const bank = [
    ...candidates("Linguagens", 30),
    ...candidates("Ciências Humanas", 30),
    ...candidates("Matemática", 50),
    ...candidates("Ciências da Natureza", 50),
  ];

  it("asks a subject's mock only that subject's questions", () => {
    const options = listMockOptions({
      dayInTurn: null,
      goalAreas: GOAL_AREAS,
      structure: TWO_DAYS,
    });

    const math = options.find((option) => option.areas[0] === "Matemática e suas Tecnologias");

    if (!math) {
      throw new Error("Expected a math option");
    }

    const plan = planOptionMock({ candidates: bank, option: math, structure: TWO_DAYS });

    expect(plan.sections).toHaveLength(1);
    expect(plan.sections[0]?.name).toBe("Matemática e suas Tecnologias");
    expect(plan.sections[0]?.itemIds).toHaveLength(45);
    expect(plan.sections[0]?.itemIds.every((id) => id.startsWith("Matemática"))).toBe(true);
  });

  it("asks a subject's mock the questions of the plan's area for it, never a similar subject's", () => {
    const options = listMockOptions({ dayInTurn: null, goalAreas: OAB_AREAS, structure: OAB });
    const child = options.find((option) => option.area === "Direito da Criança e do Adolescente");
    const civil = options.find((option) => option.area === "Direito Civil");

    if (!child || !civil) {
      throw new Error("Expected the ECA's and Direito Civil's options");
    }

    const oabBank = [
      ...candidates("Estatuto da Criança e do Adolescente", 25),
      ...candidates("Direito Civil", 25),
      ...candidates("Direito Processual Civil", 25),
    ];

    const childPlan = planOptionMock({ candidates: oabBank, option: child, structure: OAB });
    const civilPlan = planOptionMock({ candidates: oabBank, option: civil, structure: OAB });

    expect(childPlan.sections[0]?.itemIds).toHaveLength(20);

    expect(childPlan.sections[0]?.itemIds.every((id) => id.startsWith("Estatuto da Criança"))).toBe(
      true,
    );

    expect(civilPlan.sections[0]?.itemIds.every((id) => id.startsWith("Direito Civil"))).toBe(true);
  });

  it("asks each of a day's subjects its share, by the plan's full area names, never the essay", () => {
    const [, dayTwo] = listMockOptions({
      dayInTurn: null,
      goalAreas: GOAL_AREAS,
      structure: TWO_DAYS,
    });

    if (!dayTwo) {
      throw new Error("Expected day two");
    }

    const fullNames = [
      ...candidates("Ciências da Natureza e suas Tecnologias", 80),
      ...candidates("Matemática e suas Tecnologias", 60),
      ...candidates("Redação", 10),
    ];

    const plan = planOptionMock({ candidates: fullNames, option: dayTwo, structure: TWO_DAYS });
    const asked = plan.sections.flatMap((section) => section.itemIds);
    const count = (prefix: string) => asked.filter((id) => id.startsWith(prefix)).length;

    expect(plan.sections[0]?.name).toBe("Ciências da Natureza e Matemática");
    expect(count("Ciências da Natureza")).toBe(45);
    expect(count("Matemática")).toBe(45);
    expect(count("Redação")).toBe(0);
  });

  it("keeps a full mock in the exam's proportions with new questions only, short of what the bank lacks", () => {
    // The OAB's shape: one test whose subjects the past edition counts, ethics 8 of 20.
    const oab: ExamStructure = {
      ...OAB,
      mock: OAB.mock && {
        ...OAB.mock,
        sections: [{ day: null, minutes: 75, name: "Prova objetiva", questions: 20 }],
        timeLimitMinutes: 75,
        totalQuestions: 20,
      },
      subjects: [
        subject("Ética Profissional", 8),
        subject("Direito Civil", 6),
        subject("Direito Penal", 6),
      ],
    };

    const answered = (area: string, count: number) =>
      candidates(area, count).map((candidate) => ({
        ...candidate,
        answered: true,
        itemId: `${candidate.itemId}-answered`,
      }));

    // Ethics has many questions the learner answered in its own mocks; the others have few new ones.
    const oabBank = [
      ...candidates("Ética Profissional", 3),
      ...answered("Ética Profissional", 20),
      ...candidates("Direito Civil", 1),
      ...candidates("Direito Penal", 6),
    ];

    const [full] = listMockOptions({
      dayInTurn: null,
      goalAreas: ["Ética Profissional", "Direito Civil", "Direito Penal"],
      structure: oab,
    });

    if (!full) {
      throw new Error("Expected the full exam");
    }

    const plan = planOptionMock({ candidates: oabBank, option: full, structure: oab });
    const asked = plan.sections.flatMap((section) => section.itemIds);
    const count = (prefix: string) => asked.filter((id) => id.startsWith(prefix)).length;

    // Each subject asks at most its count, from new questions: what one lacks stays empty.
    expect({
      civil: count("Direito Civil"),
      criminal: count("Direito Penal"),
      ethics: count("Ética Profissional"),
    }).toStrictEqual({ civil: 1, criminal: 6, ethics: 3 });

    expect(asked.some((id) => id.endsWith("-answered"))).toBe(false);
    expect(plan.reused).toBe(0);
    // At the exam's pace: 10 of its 20 questions in half its time.
    expect(plan.minutes).toBe(38);
  });

  it("asks the day an exam day's mock copies", () => {
    const [, dayTwo] = listMockOptions({
      dayInTurn: null,
      goalAreas: GOAL_AREAS,
      structure: TWO_DAYS,
    });

    if (!dayTwo) {
      throw new Error("Expected day two");
    }

    const plan = planOptionMock({ candidates: bank, option: dayTwo, structure: TWO_DAYS });

    expect(plan.day).toBe(2);
    expect(countPlannedQuestions(plan)).toBe(90);
  });
});

describe(getMockQuestionsShortfall, () => {
  const [, dayTwo] = listMockOptions({
    dayInTurn: null,
    goalAreas: GOAL_AREAS,
    structure: TWO_DAYS,
  });

  const skillIds = ["Matemática-skill-0", "Matemática-skill-1", "Matemática-skill-2"];

  function shortfall(bank: MockCandidate[]) {
    if (!dayTwo) {
      throw new Error("Expected day two");
    }

    return getMockQuestionsShortfall({
      candidates: bank,
      mix: getMockFormatMix(TWO_DAYS),
      option: dayTwo,
      plan: planOptionMock({ candidates: bank, option: dayTwo, structure: TWO_DAYS }),
      skills: skillIds.map((id) => ({ area: "Matemática", id })),
    });
  }

  it("asks for each skill's share when the bank is short of the mock's questions", () => {
    expect(shortfall(candidates("Matemática", 9))).toStrictEqual([
      {
        format: { key: "choice", share: 1, writer: { kind: "quick" } },
        // Each skill holds three of the fifteen its share asks.
        questionsPerSkill: 12,
        skillIds,
        target: 15,
      },
    ]);
  });

  it("asks for nothing when the bank holds the mock's questions", () => {
    expect(
      shortfall([...candidates("Matemática", 45), ...candidates("Ciências da Natureza", 45)]),
    ).toStrictEqual([]);
  });
});
