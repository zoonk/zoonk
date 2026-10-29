import { describe, expect, it } from "vitest";
import { buildSyllabus } from "./build-syllabus";
import { type SyllabusInput, type SyllabusItem } from "./syllabus-input";
import { getSkillSubjects } from "./syllabus-subjects";

const PT = "Língua Portuguesa";

const CONSTITUTIONAL =
  "Noções de Direito Constitucional e de Regimento Interno da Câmara dos Deputados";

const PROCESS = "Processo Legislativo e Regimento Interno da Câmara dos Deputados";

function lesson(
  attrs: Partial<SyllabusItem> & Pick<SyllabusItem, "chapterId" | "skillId">,
): SyllabusItem {
  return {
    id: crypto.randomUUID(),
    kind: "lesson",
    lessonId: `lesson-${attrs.skillId}-${attrs.chapterId}`,
    phase: 0,
    scheduledFor: null,
    status: "todo",
    titleSnapshot: "A lesson",
    ...attrs,
  };
}

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const notice: SyllabusInput["notice"] = {
  courseWeights: null,
  fromMaterial: false,
  passMarks: null,
  questionsSource: null,
  subjects: [
    {
      group: "Conhecimentos básicos (P1)",
      name: PT,
      questions: 30,
      share: 0.5,
      shortName: null,
      topics: ["Ortografia", "Coesão textual", "Tempos verbais"],
      writtenTasks: [],
    },
    {
      group: "Conhecimentos básicos (P1)",
      name: CONSTITUTIONAL,
      questions: 20,
      share: 0.3,
      shortName: null,
      topics: ["Princípios fundamentais", "Regimento Interno da Câmara dos Deputados"],
      writtenTasks: [],
    },
    {
      group: "Conhecimentos específicos (P2)",
      name: PROCESS,
      questions: 10,
      share: 0.2,
      shortName: null,
      topics: ["Procedimento legislativo", "Regimento Interno da Câmara dos Deputados"],
      writtenTasks: [],
    },
  ],
  url: "https://example.com/edital.pdf",
};

function oldGraphInput(): SyllabusInput {
  return {
    areaCourses: new Map([
      [
        "Direito Constitucional",
        { imageUrl: "https://img/dc.webp", title: "Direito Constitucional" },
      ],
      [PT, { imageUrl: null, title: PT }],
    ]),
    chapterTitles: new Map([
      ["ch-ortho", "Grafia e acentuação"],
      ["ch-const", "A Constituição de 1988"],
      ["ch-process", "Espécies de proposições"],
    ]),
    items: [
      lesson({
        chapterId: "ch-ortho",
        scheduledFor: day("2026-10-06"),
        skillId: "s-ortho",
        status: "done",
      }),
      lesson({ chapterId: "ch-const", scheduledFor: day("2026-10-06"), skillId: "s-const" }),
      lesson({ chapterId: "ch-ortho", scheduledFor: day("2026-10-07"), skillId: "s-ortho" }),
      lesson({ chapterId: "ch-process", scheduledFor: day("2026-10-20"), skillId: "s-process" }),
      lesson({
        chapterId: null,
        lessonId: null,
        skillId: "s-strategy",
        titleSnapshot: "Estratégia",
      }),
    ],
    knownSkillIds: new Set(),
    notice,
    pastBasicsSkillIds: new Set(),
    skills: [
      { area: PT, name: "Aplicar a ortografia", skillId: "s-ortho", topics: [] },
      {
        area: "Direito Constitucional",
        name: "Situar a Constituição",
        skillId: "s-const",
        topics: [],
      },
      {
        area: "Processo Legislativo e Regimentos Parlamentares",
        name: "Classificar proposições",
        skillId: "s-process",
        topics: [],
      },
      {
        area: "Estratégia de prova",
        name: "Gerenciar o tempo da prova",
        skillId: "s-strategy",
        topics: [],
      },
    ],
    skippedAreas: [],
  };
}

function ethicsProgress(status: SyllabusItem["status"]) {
  return buildSyllabus({
    areaCourses: new Map(),
    chapterTitles: new Map(),
    items: [
      lesson({ chapterId: "ch-ethics", lessonId: "ethics-1", skillId: "s-ethics", status: "done" }),
      lesson({ chapterId: null, lessonId: null, lessons: 24, skillId: "s-statute", status }),
    ],
    knownSkillIds: new Set(),
    notice: null,
    pastBasicsSkillIds: new Set(),
    skills: [
      { area: "Ética", name: "Aplicar o Código de Ética", skillId: "s-ethics", topics: [] },
      { area: "Ética", name: "Aplicar o Estatuto", skillId: "s-statute", topics: [] },
    ],
    skippedAreas: [],
  }).subjects.map((subject) => [subject.lessonsDone, subject.lessonsKnown, subject.lessonsTotal]);
}

describe(buildSyllabus, () => {
  it("shows an old plan by the notice's subjects, its topics without a status, and its extra areas after", () => {
    const syllabus = buildSyllabus(oldGraphInput());

    expect(syllabus).toMatchObject({
      kind: "notice",
      noticeUrl: "https://example.com/edital.pdf",
      topicCount: 7,
      topicsMapped: false,
    });

    expect(
      syllabus.subjects.map((subject) => [
        subject.key,
        subject.source,
        subject.areas,
        subject.group,
      ]),
    ).toStrictEqual([
      ["lingua-portuguesa", "notice", [PT], "Conhecimentos básicos (P1)"],
      [
        "nocoes-de-direito-constitucional-e-de-regimento",
        "notice",
        ["Direito Constitucional"],
        "Conhecimentos básicos (P1)",
      ],
      [
        "processo-legislativo-e-regimento-interno-da",
        "notice",
        ["Processo Legislativo e Regimentos Parlamentares"],
        "Conhecimentos específicos (P2)",
      ],
      ["estrategia-de-prova", "plan", ["Estratégia de prova"], null],
    ]);

    const [portuguese, constitutional] = syllabus.subjects;

    expect(portuguese).toMatchObject({
      imageUrl: null,
      lessonsDone: 1,
      lessonsTotal: 2,
      nextDate: "2026-10-07",
      notPlannedReason: null,
      share: 0.5,
      shortName: PT,
      topicsStudied: null,
    });

    expect(portuguese?.topics).toStrictEqual(
      ["Ortografia", "Coesão textual", "Tempos verbais"].map((name) => ({
        chapters: [],
        frequency: null,
        heading: null,
        name,
        nextDate: null,
        notPlannedReason: null,
        status: null,
      })),
    );

    expect(portuguese?.chapters).toStrictEqual([
      {
        chapterId: "ch-ortho",
        far: false,
        known: false,
        lessonsDone: 1,
        lessonsTotal: 2,
        nextDate: "2026-10-07",
        plannedLessons: null,
        position: 1,
        skillId: null,
        state: "upcoming",
        title: "Grafia e acentuação",
        writing: false,
      },
    ]);

    expect(constitutional).toMatchObject({
      chapters: [{ chapterId: "ch-const", state: "current", title: "A Constituição de 1988" }],
      imageUrl: "https://img/dc.webp",
      shortName: "Direito Constitucional",
    });

    expect(syllabus.subjects[3]?.chapters).toStrictEqual([
      {
        chapterId: null,
        far: false,
        known: false,
        lessonsDone: 0,
        lessonsTotal: 1,
        nextDate: null,
        plannedLessons: null,
        position: 1,
        skillId: null,
        state: "upcoming",
        title: "Gerenciar o tempo da prova",
        writing: true,
      },
    ]);
  });

  it("ticks each topic from the lessons of the skills that teach it, and says why one isn't in the plan", () => {
    const input = oldGraphInput();

    const syllabus = buildSyllabus({
      ...input,
      items: [
        lesson({ chapterId: "ch-ortho", skillId: "s-ortho", status: "done" }),
        lesson({
          chapterId: "ch-cohesion",
          scheduledFor: day("2026-10-08"),
          skillId: "s-cohesion",
          status: "done",
        }),
        lesson({
          chapterId: "ch-cohesion",
          scheduledFor: day("2026-10-09"),
          skillId: "s-cohesion",
        }),
        lesson({ chapterId: "ch-const", scheduledFor: day("2026-10-10"), skillId: "s-const" }),
        lesson({ chapterId: "ch-rules", scheduledFor: day("2026-10-12"), skillId: "s-rules" }),
        lesson({ chapterId: "ch-house", scheduledFor: day("2026-10-15"), skillId: "s-house" }),
      ],
      knownSkillIds: new Set(),
      pastBasicsSkillIds: new Set(),
      skills: [
        { area: PT, name: "Aplicar a ortografia", skillId: "s-ortho", topics: ["Ortografia"] },
        { area: PT, name: "Analisar a coesão", skillId: "s-cohesion", topics: ["coesao textual"] },
        {
          area: PT,
          name: "Interpretar tempos verbais",
          skillId: "s-verbs",
          topics: ["Tempos verbais"],
        },
        {
          area: CONSTITUTIONAL,
          name: "Aplicar os princípios",
          skillId: "s-const",
          topics: ["Princípios fundamentais"],
        },
        {
          area: CONSTITUTIONAL,
          name: "Aplicar o Regimento",
          skillId: "s-rules",
          topics: ["Regimento Interno da Câmara dos Deputados"],
        },
        {
          area: PROCESS,
          name: "Seguir a tramitação na Câmara",
          skillId: "s-house",
          topics: ["Regimento Interno da Câmara dos Deputados"],
        },
      ],
      skippedAreas: [PROCESS],
    });

    expect(syllabus.topicsMapped).toBe(true);

    const [portuguese, constitutional, process] = syllabus.subjects;

    expect(portuguese?.topicsStudied).toBe(1);

    expect(
      portuguese?.topics.map((topic) => [
        topic.name,
        topic.status,
        topic.notPlannedReason,
        topic.nextDate,
      ]),
    ).toStrictEqual([
      ["Ortografia", "studied", null, null],
      ["Coesão textual", "inProgress", null, "2026-10-09"],
      ["Tempos verbais", "notPlanned", "time", null],
    ]);

    expect(portuguese?.topics[1]?.chapters.map((chapter) => chapter.chapterId)).toStrictEqual([
      "ch-cohesion",
    ]);

    expect(
      constitutional?.topics.map((topic) => [topic.status, topic.chapters.length]),
    ).toStrictEqual([
      ["toStudy", 1],
      ["toStudy", 1],
    ]);

    expect(constitutional?.topics[1]?.chapters[0]?.chapterId).toBe("ch-rules");

    expect(
      syllabus.subjects.map((subject) =>
        subject.chapters.map((chapter) => [chapter.chapterId, chapter.position]),
      ),
    ).toStrictEqual([
      [
        ["ch-ortho", 1],
        ["ch-cohesion", 2],
      ],
      [
        ["ch-const", 1],
        ["ch-rules", 2],
      ],
      [["ch-house", 1]],
    ]);

    expect(process?.notPlannedReason).toBe("skipped");

    expect(process?.topics.map((topic) => topic.notPlannedReason)).toStrictEqual([
      "skipped",
      "skipped",
    ]);
  });

  it("never counts lessons set aside as studied or known", () => {
    const skills = [
      { area: PT, name: "Aplicar a ortografia", skillId: "s-ortho", topics: ["Ortografia"] },
      { area: PT, name: "Analisar a coesão", skillId: "s-cohesion", topics: ["Coesão textual"] },
      { area: PT, name: "Usar tempos verbais", skillId: "s-verbs", topics: ["Tempos verbais"] },
      { area: PT, name: "Usar a crase", skillId: "s-crase", topics: ["Crase"] },
    ];

    const items = [
      lesson({ chapterId: "ch-ortho", lessonId: "ortho-1", skillId: "s-ortho", status: "done" }),
      lesson({ chapterId: "ch-ortho", lessonId: "ortho-2", skillId: "s-ortho", status: "skipped" }),
      lesson({ chapterId: "ch-cohesion", skillId: "s-cohesion", status: "skipped" }),
      lesson({ chapterId: "ch-verbs", skillId: "s-verbs", status: "testedOut" }),
      lesson({ chapterId: "ch-crase", lessonId: "crase-1", skillId: "s-crase", status: "skipped" }),
      lesson({ chapterId: "ch-crase", lessonId: "crase-2", skillId: "s-crase", status: "todo" }),
    ];

    const withCrase = notice && {
      ...notice,
      subjects: notice.subjects.map((subject) =>
        subject.name === PT ? { ...subject, topics: [...subject.topics, "Crase"] } : subject,
      ),
    };

    const [portuguese] = buildSyllabus({
      ...oldGraphInput(),
      items,
      notice: withCrase,
      skills,
    }).subjects;

    expect(
      portuguese?.topics.map((topic) => [
        topic.name,
        topic.status,
        topic.notPlannedReason,
        topic.chapters.map((chapter) => chapter.chapterId),
      ]),
    ).toStrictEqual([
      ["Ortografia", "inProgress", "time", ["ch-ortho"]],
      ["Coesão textual", "notPlanned", "time", []],
      ["Tempos verbais", "known", null, ["ch-verbs"]],
      ["Crase", "toStudy", null, ["ch-crase"]],
    ]);

    expect(
      portuguese?.chapters.map(({ chapterId, lessonsDone, lessonsTotal, state }) => [
        chapterId,
        lessonsDone,
        lessonsTotal,
        state,
      ]),
    ).toStrictEqual([
      ["ch-verbs", 1, 1, "done"],
      ["ch-ortho", 1, 2, "upcoming"],
      ["ch-cohesion", 0, 1, "upcoming"],
      ["ch-crase", 0, 2, "current"],
    ]);

    expect(portuguese).toMatchObject({ lessonsDone: 1, lessonsKnown: 1, topicsStudied: 0 });

    const [takenOut] = buildSyllabus({
      ...oldGraphInput(),
      items: items.filter((item) => item.skillId === "s-cohesion"),
      skills,
      skippedAreas: [PT],
    }).subjects;

    expect(takenOut?.topics[1]).toMatchObject({ chapters: [], status: "notPlanned" });
  });

  it("shows what the learner studied of a subject they took out, with the note that they took it out", () => {
    const syllabus = buildSyllabus({
      ...oldGraphInput(),
      items: [
        lesson({ chapterId: "ch-ortho", skillId: "s-ortho", status: "done" }),
        lesson({ chapterId: "ch-const", scheduledFor: day("2026-10-10"), skillId: "s-const" }),
      ],
      knownSkillIds: new Set(),
      pastBasicsSkillIds: new Set(),
      skills: [
        { area: PT, name: "Aplicar a ortografia", skillId: "s-ortho", topics: ["Ortografia"] },
        {
          area: PT,
          name: "Interpretar tempos verbais",
          skillId: "s-verbs",
          topics: ["Tempos verbais"],
        },
        {
          area: CONSTITUTIONAL,
          name: "Aplicar os princípios",
          skillId: "s-const",
          topics: ["Princípios fundamentais"],
        },
      ],
      skippedAreas: [PT],
    });

    const [portuguese] = syllabus.subjects;

    expect(portuguese?.notPlannedReason).toBe("skipped");

    expect(
      portuguese?.topics.map((topic) => [
        topic.name,
        topic.status,
        topic.notPlannedReason,
        topic.chapters.map((chapter) => chapter.chapterId),
      ]),
    ).toStrictEqual([
      ["Ortografia", "studied", "skipped", ["ch-ortho"]],
      ["Coesão textual", "notPlanned", "skipped", []],
      ["Tempos verbais", "notPlanned", "skipped", []],
    ]);
  });

  it("counts a chapter's own lessons, as its page lists them, and its skill's lessons still being written on their own row", () => {
    const input = oldGraphInput();

    const withStandIn = {
      ...input,
      items: [
        ...input.items,
        lesson({
          chapterId: null,
          lessonId: null,
          lessons: 4,
          scheduledFor: day("2026-10-09"),
          skillId: "s-ortho",
        }),
      ],
      taughtSkillIds: new Set(["s-ortho"]),
    };

    const syllabus = buildSyllabus({ ...withStandIn, outlinedUntil: "2026-10-08" });

    expect(syllabus.subjects[0]?.chapters).toStrictEqual([
      {
        chapterId: "ch-ortho",
        far: false,
        known: false,
        lessonsDone: 1,
        lessonsTotal: 2,
        nextDate: "2026-10-07",
        plannedLessons: null,
        position: 1,
        skillId: null,
        state: "upcoming",
        title: "Grafia e acentuação",
        writing: false,
      },
      {
        chapterId: null,
        far: true,
        known: false,
        lessonsDone: 0,
        lessonsTotal: 4,
        nextDate: "2026-10-09",
        plannedLessons: 4,
        position: 2,
        skillId: "s-ortho",
        state: "upcoming",
        title: "Aplicar a ortografia",
        writing: true,
      },
    ]);

    const untaught = buildSyllabus({
      ...withStandIn,
      outlinedUntil: "2026-10-08",
      taughtSkillIds: new Set(),
    });

    expect(untaught.subjects[0]?.chapters[1]).toMatchObject({ far: true, skillId: "s-ortho" });

    const near = buildSyllabus({ ...withStandIn, outlinedUntil: "2026-10-09" });

    expect(near.subjects[0]?.chapters[1]).toMatchObject({
      far: false,
      skillId: null,
      writing: true,
    });

    const unsized = buildSyllabus({
      ...withStandIn,
      items: withStandIn.items.map((item) => (item.lessonId ? item : { ...item, lessons: null })),
      outlinedUntil: "2026-10-08",
    });

    expect(unsized.subjects[0]?.chapters[1]).toMatchObject({
      far: true,
      plannedLessons: null,
      writing: true,
    });
  });

  it("puts the plan's area for part of a written test under the subject whose test asks it", () => {
    const discursive = {
      group: "Prova discursiva (P3)",
      name: "Prova discursiva",
      questions: null,
      share: null,
      shortName: null,
      topics: ["Questões discursivas sobre os conhecimentos específicos"],
      writtenTasks: [
        "questões discursivas sobre conhecimentos específicos, de até 20 linhas",
        "peça técnica sobre conhecimentos específicos, de até 50 linhas",
      ],
    };

    const input = oldGraphInput();

    const syllabus = buildSyllabus({
      ...input,
      notice: input.notice && { ...input.notice, subjects: [...input.notice.subjects, discursive] },
      skills: [
        ...input.skills,
        { area: "Peça técnica", name: "Redigir uma peça técnica", skillId: "s-peca", topics: [] },
      ],
    });

    expect(syllabus.subjects.find((subject) => subject.name === "Prova discursiva")).toMatchObject({
      areas: ["Peça técnica"],
      shortName: "Prova discursiva",
    });

    expect(syllabus.subjects.some((subject) => subject.name === "Peça técnica")).toBe(false);
  });

  it("says a notice topic no skill teaches isn't in the plan yet", () => {
    const syllabus = buildSyllabus({
      ...oldGraphInput(),
      skills: [
        { area: PT, name: "Aplicar a ortografia", skillId: "s-ortho", topics: ["Ortografia"] },
        { area: CONSTITUTIONAL, name: "Situar a Constituição", skillId: "s-const", topics: [] },
      ],
    });

    expect(syllabus.subjects[0]?.topics[1]).toMatchObject({
      notPlannedReason: "missing",
      status: "notPlanned",
    });

    expect(syllabus.subjects[2]).toMatchObject({
      areas: [],
      lessonsTotal: 0,
      notPlannedReason: "missing",
    });
  });

  it("reads a notice heading from the items under it, and a topic another subject teaches from that subject's lessons", () => {
    const outlined = {
      ...notice,
      subjects: notice.subjects.map((subject, index) =>
        index === 0
          ? {
              ...subject,
              topics: [
                "1 Grafia",
                "1.1 Ortografia",
                "1.2 Acentuação",
                "2 Coesão textual",
                "3 Tempos verbais",
                "3.1 Presente",
              ],
            }
          : subject,
      ),
    };

    const syllabus = buildSyllabus({
      ...oldGraphInput(),
      notice: outlined,
      skills: [
        { area: PT, name: "Aplicar a ortografia", skillId: "s-ortho", topics: ["1.1 Ortografia"] },
        {
          area: CONSTITUTIONAL,
          name: "Situar a Constituição",
          skillId: "s-const",
          topics: ["Princípios fundamentais", "2 Coesão textual"],
        },
      ],
    });

    const statusOf = (name: string) => {
      const topic = syllabus.subjects[0]?.topics.find((item) => item.name === name);
      return [topic?.status, topic?.notPlannedReason];
    };

    expect(statusOf("1 Grafia")).toStrictEqual(["inProgress", null]);
    expect(statusOf("1.2 Acentuação")).toStrictEqual(["notPlanned", "missing"]);

    expect(statusOf("2 Coesão textual")).toStrictEqual(["toStudy", null]);

    expect(statusOf("3 Tempos verbais")).toStrictEqual(["notPlanned", "missing"]);
  });

  it("matches a plan's topics to a notice read again with its items' numbers", () => {
    const numbered = {
      ...notice,
      subjects: notice.subjects.map((subject, index) =>
        index === 0
          ? { ...subject, topics: ["1 Ortografia", "2.1 Coesão textual", "3 Tempos verbais"] }
          : subject,
      ),
    };

    const syllabus = buildSyllabus({
      ...oldGraphInput(),
      notice: numbered,
      skills: [
        { area: PT, name: "Aplicar a ortografia", skillId: "s-ortho", topics: ["Ortografia"] },
        { area: CONSTITUTIONAL, name: "Situar a Constituição", skillId: "s-const", topics: [] },
      ],
    });

    expect(syllabus.subjects[0]?.topics[0]).toMatchObject({
      name: "1 Ortografia",
      notPlannedReason: null,
      status: "inProgress",
    });
  });

  it("shows the plan's own areas when they don't follow the notice", () => {
    const syllabus = buildSyllabus({
      ...oldGraphInput(),
      items: [lesson({ chapterId: "ch-eco", skillId: "s-eco" })],
      skills: [
        { area: "Ecologia", name: "Cadeias alimentares", skillId: "s-eco", topics: [] },
        { area: "Filosofia", name: "Ética", skillId: "s-phil", topics: [] },
        { area: PT, name: "Aplicar a ortografia", skillId: "s-ortho", topics: [] },
      ],
    });

    expect(syllabus).toMatchObject({
      kind: "modules",
      noticeUrl: null,
      topicCount: 0,
      topicsMapped: false,
    });

    expect(
      syllabus.subjects.map((subject) => [subject.name, subject.source, subject.topics]),
    ).toStrictEqual([
      ["Ecologia", "plan", []],
      ["Filosofia", "plan", []],
      [PT, "plan", []],
    ]);

    expect(syllabus.subjects[1]?.notPlannedReason).toBe("time");
  });

  it("names a subject by the notice's short name before its areas' and courses' names", () => {
    const shortNames = ["Português", "Direito Constitucional e Regimento", "Processo Legislativo"];
    const subjects = notice?.subjects ?? [];

    const withShortNames: SyllabusInput = {
      ...oldGraphInput(),
      notice: {
        courseWeights: null,
        fromMaterial: false,
        passMarks: null,
        questionsSource: null,
        subjects: subjects.map((subject, index) => ({
          ...subject,
          shortName: shortNames[index] ?? null,
        })),
        url: null,
      },
    };

    expect(
      buildSyllabus(withShortNames).subjects.map((subject) => subject.shortName),
    ).toStrictEqual([
      "Português",
      "Direito Constitucional e Regimento",
      "Processo Legislativo",
      "Estratégia de prova",
    ]);

    expect(getSkillSubjects(withShortNames)).toStrictEqual(
      new Map([
        ["s-ortho", "Português"],
        ["s-const", "Direito Constitucional e Regimento"],
        ["s-process", "Processo Legislativo"],
        ["s-strategy", "Estratégia de prova"],
      ]),
    );
  });

  it("puts an area named by a subject's short name in that subject", () => {
    const ethics =
      "Estatuto da Advocacia e da OAB, seu Regulamento Geral e Código de Ética e Disciplina da OAB";

    const input: SyllabusInput = {
      areaCourses: new Map(),
      chapterTitles: new Map([["ch-fees", "Honorários"]]),
      items: [lesson({ chapterId: "ch-fees", skillId: "s-fees" })],
      knownSkillIds: new Set(),
      notice: {
        courseWeights: null,
        fromMaterial: false,
        passMarks: null,
        questionsSource: null,
        subjects: [
          {
            group: null,
            name: ethics,
            questions: 8,
            share: 0.1,
            shortName: "Ética Profissional",
            topics: [],
            writtenTasks: [],
          },
        ],
        url: null,
      },
      pastBasicsSkillIds: new Set(),
      skills: [
        {
          area: "Ética Profissional",
          name: "Aplicar regras de honorários",
          skillId: "s-fees",
          topics: [],
        },
      ],
      skippedAreas: [],
    };

    const { subjects } = buildSyllabus(input);

    expect(subjects).toHaveLength(1);

    expect(subjects[0]).toMatchObject({
      areas: ["Ética Profissional"],
      lessonsTotal: 1,
      name: ethics,
      notPlannedReason: null,
      source: "notice",
    });
  });

  it("shows a topic the learner showed they know as known, never as left out", () => {
    const biology = {
      group: null,
      name: "Biologia",
      questions: null,
      share: null,
      shortName: null,
      topics: ["Membrana plasmática", "Organelas", "Teoria celular", "Vírus"],
      writtenTasks: [],
    };

    const input: SyllabusInput = {
      areaCourses: new Map(),
      chapterTitles: new Map([["ch-cell", "A célula"]]),
      items: [
        lesson({ chapterId: "ch-cell", skillId: "s-membrane" }),
        lesson({ chapterId: "ch-cell", skillId: "s-theory", status: "testedOut" }),
      ],
      knownSkillIds: new Set(["s-organelles", "s-theory"]),
      notice: {
        courseWeights: null,
        fromMaterial: true,
        passMarks: null,
        questionsSource: null,
        subjects: [biology],
        url: null,
      },
      pastBasicsSkillIds: new Set(),
      skills: [
        {
          area: "Biologia",
          name: "Membrana",
          skillId: "s-membrane",
          topics: ["Membrana plasmática"],
        },
        { area: "Biologia", name: "Organelas", skillId: "s-organelles", topics: ["Organelas"] },
        { area: "Biologia", name: "Teoria", skillId: "s-theory", topics: ["Teoria celular"] },
        { area: "Biologia", name: "Vírus", skillId: "s-virus", topics: ["Vírus"] },
      ],
      skippedAreas: [],
    };

    const [subject] = buildSyllabus(input).subjects;

    expect(
      subject?.topics.map((topic) => [topic.name, topic.status, topic.notPlannedReason]),
    ).toStrictEqual([
      ["Membrana plasmática", "toStudy", null],
      ["Organelas", "known", null],
      ["Teoria celular", "known", null],
      ["Vírus", "notPlanned", "time"],
    ]);

    expect(subject).toMatchObject({ topicsKnown: 2, topicsStudied: 0 });
  });

  it("keeps an area's own name when its course is another subject's", () => {
    const input = oldGraphInput();

    const syllabus = buildSyllabus({
      ...input,
      areaCourses: new Map([
        ...input.areaCourses,
        ["Estratégia de prova", { imageUrl: null, title: "Raciocínio Lógico" }],
      ]),
    });

    expect(syllabus.subjects.at(-1)).toMatchObject({
      name: "Estratégia de prova",
      shortName: "Estratégia de prova",
    });
  });

  it("names modules by area in teaching order, and a lesson without a skill by its chapter's area", () => {
    const syllabus = buildSyllabus({
      areaCourses: new Map(),
      chapterTitles: new Map([["ch-research", "Entrevistas com usuários"]]),
      items: [
        lesson({ chapterId: "ch-research", skillId: "s-interview", status: "done" }),
        lesson({ chapterId: "ch-research", skillId: null }),
        lesson({ chapterId: "ch-figma", skillId: "s-figma" }),
      ],
      knownSkillIds: new Set(),
      notice: null,
      pastBasicsSkillIds: new Set(),
      skills: [
        {
          area: "Pesquisa com usuários",
          name: "Conduzir entrevistas",
          skillId: "s-interview",
          topics: [],
        },
        {
          area: "Prototipação e Figma",
          name: "Prototipar no Figma",
          skillId: "s-figma",
          topics: [],
        },
      ],
      skippedAreas: [],
    });

    expect(
      syllabus.subjects.map((subject) => [subject.key, subject.lessonsDone, subject.lessonsTotal]),
    ).toStrictEqual([
      ["pesquisa-com-usuarios", 1, 2],
      ["prototipacao-e-figma", 0, 1],
    ]);

    expect(syllabus.subjects[0]?.chapters[0]).toMatchObject({
      lessonsDone: 1,
      lessonsTotal: 2,
      state: "current",
    });
  });

  it("counts an item standing in for a skill's unwritten lessons as the lessons it plans", () => {
    const syllabus = buildSyllabus({
      areaCourses: new Map(),
      chapterTitles: new Map(),
      items: [
        lesson({ chapterId: "ch-research", skillId: "s-interview", status: "done" }),
        lesson({ chapterId: null, lessonId: null, lessons: 4, skillId: "s-interview" }),
        lesson({ chapterId: null, lessonId: null, lessons: 9, skillId: "s-prototype" }),
      ],
      knownSkillIds: new Set(),
      notice: null,
      pastBasicsSkillIds: new Set(),
      skills: [
        {
          area: "Pesquisa com usuários",
          name: "Conduzir entrevistas",
          skillId: "s-interview",
          topics: [],
        },
        {
          area: "Prototipação e testes de usabilidade",
          name: "Montar protótipos interativos",
          skillId: "s-prototype",
          topics: [],
        },
      ],
      skippedAreas: [],
    });

    expect(
      syllabus.subjects.map((subject) => [subject.key, subject.lessonsDone, subject.lessonsTotal]),
    ).toStrictEqual([
      ["pesquisa-com-usuarios", 1, 5],
      ["prototipacao-e-testes-de-usabilidade", 0, 9],
    ]);
  });

  it("sizes a subject by the lessons the plan teaches, never moving what the learner did", () => {
    const skills = [
      { area: "Matemática", name: "Usar porcentagens", skillId: "s-pct", topics: [] },
      { area: "Matemática", name: "Ler gráficos", skillId: "s-chart", topics: [] },
    ];

    const progress = (items: SyllabusItem[], deadline?: boolean) =>
      buildSyllabus({
        areaCourses: new Map(),
        chapterTitles: new Map(),
        deadline,
        items,
        knownSkillIds: new Set(),
        notice: null,
        pastBasicsSkillIds: new Set(),
        skills,
        skippedAreas: [],
      }).subjects.map((subject) => [subject.lessonsDone, subject.lessonsTotal]);

    const done = lesson({
      chapterId: "ch-pct",
      lessonId: "pct-1",
      skillId: "s-pct",
      status: "done",
    });

    const pct = (index: number) =>
      lesson({ chapterId: "ch-pct", lessonId: `pct-${index}`, skillId: "s-pct" });

    expect(
      progress([
        done,
        ...[2, 3, 4, 5, 6].map((index) => pct(index)),
        lesson({ chapterId: null, lessonId: null, lessons: 4, skillId: "s-chart" }),
      ]),
    ).toStrictEqual([[1, 10]]);

    const cut = [
      done,
      pct(2),
      { ...pct(3), status: "skipped" as const },
      lesson({ chapterId: null, lessonId: null, lessons: 2, skillId: "s-chart" }),
    ];

    expect(progress(cut)).toStrictEqual([[1, 5]]);

    expect(progress(cut, false)).toStrictEqual([[1, 4]]);
  });

  it("counts a tested-out lesson that stands for two skills once", () => {
    const known = lesson({
      chapterId: "ch-pct",
      lessonId: "pct-1",
      skillId: "s-pct",
      status: "testedOut",
    });

    const read = (chartArea: string) =>
      buildSyllabus({
        areaCourses: new Map(),
        chapterTitles: new Map(),
        items: [
          known,
          { ...known, skillId: "s-chart" },
          lesson({ chapterId: "ch-pct", lessonId: "pct-2", skillId: "s-pct" }),
        ],
        knownSkillIds: new Set(),
        notice: null,
        pastBasicsSkillIds: new Set(),
        skills: [
          { area: "Matemática", name: "Usar porcentagens", skillId: "s-pct", topics: [] },
          { area: chartArea, name: "Ler gráficos", skillId: "s-chart", topics: [] },
        ],
        skippedAreas: [],
      });

    const together = read("Matemática");

    expect(together.lessons).toStrictEqual({ done: 1, known: 1, total: 2 });
    expect(together.subjects.map((subject) => subject.lessonsTotal)).toStrictEqual([2]);

    expect(
      together.subjects[0]?.chapters.map(({ lessonsDone, lessonsTotal }) => [
        lessonsDone,
        lessonsTotal,
      ]),
    ).toStrictEqual([[1, 2]]);

    const apart = read("Gráficos");

    expect(apart.lessons).toStrictEqual({ done: 1, known: 1, total: 2 });

    expect(
      apart.subjects.map((subject) => [subject.lessonsKnown, subject.lessonsTotal]),
    ).toStrictEqual([
      [1, 2],
      [1, 1],
    ]);
  });

  it("counts tested-out lessons apart from studied ones, so taking them back never lowers what was done", () => {
    expect(ethicsProgress("testedOut")).toStrictEqual([[1, 24, 25]]);
    expect(ethicsProgress("todo")).toStrictEqual([[1, 0, 25]]);
    expect(ethicsProgress("skipped")).toStrictEqual([[1, 0, 25]]);
  });

  it("marks a chapter done only by lessons the learner showed they know as known", () => {
    const skill = { area: "Ética", topics: [] };

    const syllabus = buildSyllabus({
      areaCourses: new Map(),
      chapterTitles: new Map(),
      items: [
        lesson({ chapterId: "ch-code", lessonId: "code-1", skillId: "s-code", status: "done" }),
        lesson({
          chapterId: "ch-code",
          lessonId: "code-2",
          skillId: "s-code",
          status: "testedOut",
        }),
        lesson({
          chapterId: "ch-statute",
          lessonId: "statute-1",
          skillId: "s-statute",
          status: "testedOut",
        }),
        lesson({
          chapterId: "ch-statute",
          lessonId: "statute-2",
          skillId: "s-statute",
          status: "testedOut",
        }),
      ],
      knownSkillIds: new Set(),
      notice: null,
      pastBasicsSkillIds: new Set(),
      skills: [
        { ...skill, name: "Aplicar o Código de Ética", skillId: "s-code" },
        { ...skill, name: "Aplicar o Estatuto", skillId: "s-statute" },
      ],
      skippedAreas: [],
    });

    expect(
      syllabus.subjects[0]?.chapters.map((chapter) => [
        chapter.chapterId,
        chapter.state,
        chapter.known,
      ]),
    ).toStrictEqual([
      ["ch-code", "done", false],
      ["ch-statute", "done", true],
    ]);
  });

  it("shows the topics of a subject planned from an earlier reading without a status", () => {
    const nature = "Ciências da Natureza e suas Tecnologias";

    const syllabus = buildSyllabus({
      areaCourses: new Map(),
      chapterTitles: new Map(),
      items: [lesson({ chapterId: "ch-genetics", skillId: "s-genetics" })],
      knownSkillIds: new Set(),
      notice: {
        courseWeights: null,
        fromMaterial: false,
        passMarks: null,
        questionsSource: null,
        subjects: [
          {
            group: null,
            matrix: ["H13 – Reconhecer mecanismos de transmissão da vida"],
            name: nature,
            questions: 45,
            share: null,
            shortName: "Natureza",
            topics: ["Moléculas, células e tecidos", "Hereditariedade e diversidade da vida"],
            writtenTasks: [],
          },
        ],
        url: null,
      },
      pastBasicsSkillIds: new Set(),
      skills: [
        {
          area: nature,
          name: "Prever a transmissão de características",
          skillId: "s-genetics",
          topics: ["H13 – Reconhecer mecanismos de transmissão da vida"],
        },
      ],
      skippedAreas: [],
    });

    const [subject] = syllabus.subjects;

    expect(subject?.topics.map((topic) => topic.status)).toStrictEqual([null, null]);
    expect(subject?.topicsStudied).toBeNull();
    expect(subject?.matrix).toStrictEqual(["H13 – Reconhecer mecanismos de transmissão da vida"]);
  });

  it("tags each topic with how often past exams asked it and the notice's heading over it", () => {
    const nature = "Ciências da Natureza e suas Tecnologias";

    const syllabus = buildSyllabus({
      areaCourses: new Map(),
      chapterTitles: new Map(),
      items: [lesson({ chapterId: "ch-energy", skillId: "s-energy" })],
      knownSkillIds: new Set(),
      notice: {
        courseWeights: null,
        fromMaterial: false,
        passMarks: null,
        questionsSource: null,
        subjects: [
          {
            group: null,
            name: nature,
            questions: 45,
            share: null,
            shortName: "Natureza",
            topicFrequency: new Map([["Energia, trabalho e potência", "high"]]),
            topicHeadings: new Map([
              ["Energia, trabalho e potência", "Física"],
              ["Transformações químicas", "Química"],
            ]),
            topics: ["Energia, trabalho e potência", "Transformações químicas"],
            writtenTasks: [],
          },
        ],
        url: null,
      },
      pastBasicsSkillIds: new Set(),
      skills: [
        {
          area: nature,
          name: "Energia",
          skillId: "s-energy",
          topics: ["Energia, trabalho e potência"],
        },
      ],
      skippedAreas: [],
    });

    expect(
      syllabus.subjects[0]?.topics.map(({ frequency, heading, name }) => ({
        frequency,
        heading,
        name,
      })),
    ).toStrictEqual([
      { frequency: "high", heading: "Física", name: "Energia, trabalho e potência" },
      { frequency: null, heading: "Química", name: "Transformações químicas" },
    ]);
  });

  it("shows the option a learner picked inside the subject the notice counts it in, never as a subject of its own", () => {
    const languages = "Linguagens, Códigos e suas Tecnologias";
    const english = "Língua Inglesa";
    const math = "Matemática e suas Tecnologias";

    const input: SyllabusInput = {
      areaCourses: new Map(),
      chapterTitles: new Map(),
      items: [
        lesson({ chapterId: "ch-texts", skillId: "s-texts" }),
        lesson({ chapterId: "ch-english", skillId: "s-english" }),
        lesson({ chapterId: "ch-math", skillId: "s-math" }),
      ],
      knownSkillIds: new Set(),
      notice: {
        courseWeights: null,
        fromMaterial: false,
        passMarks: null,
        questionsSource: null,
        subjects: [
          {
            group: null,
            name: languages,
            partOf: null,
            questions: 40,
            share: 0.4,
            shortName: null,
            topics: ["Estudo do texto argumentativo"],
            writtenTasks: [],
          },
          {
            group: null,
            name: english,
            partOf: languages,
            questions: 5,
            share: 0.05,
            shortName: "Inglês",
            topics: ["Vocábulos e expressões de textos em inglês e seu tema"],
            writtenTasks: [],
          },
          {
            group: null,
            name: math,
            partOf: null,
            questions: 45,
            share: 0.45,
            shortName: null,
            topics: ["Razões e proporções"],
            writtenTasks: [],
          },
        ],
        url: null,
      },
      pastBasicsSkillIds: new Set(),
      skills: [
        {
          area: "Linguagens",
          name: "Interpretar textos argumentativos",
          skillId: "s-texts",
          topics: ["Estudo do texto argumentativo"],
        },
        {
          area: english,
          name: "Ler textos em inglês",
          skillId: "s-english",
          topics: ["Vocábulos e expressões de textos em inglês e seu tema"],
        },
        { area: "Matemática", name: "Usar proporções", skillId: "s-math", topics: [] },
      ],
      skippedAreas: [],
    };

    const { subjects } = buildSyllabus(input);

    expect(subjects.map(({ name, questions }) => [name, questions])).toStrictEqual([
      [languages, 45],
      [math, 45],
    ]);

    expect(subjects[0]).toMatchObject({ areas: ["Linguagens", english], lessonsTotal: 2 });

    expect(subjects[0]?.topics.map(({ heading, name }) => [heading, name])).toStrictEqual([
      [null, "Estudo do texto argumentativo"],
      [english, "Vocábulos e expressões de textos em inglês e seu tema"],
    ]);

    expect(getSkillSubjects(input).get("s-english")).toBe("Linguagens");
  });
});

function readLaw({
  items,
  lawWeight,
  skippedAreas = [],
}: {
  items: SyllabusItem[];
  lawWeight: number;
  skippedAreas?: string[];
}) {
  const syllabus = buildSyllabus({
    areaCourses: new Map(),
    chapterTitles: new Map(),
    items,
    knownSkillIds: new Set(),
    notice: null,
    pastBasicsSkillIds: new Set(),
    sections: [
      { mastery: null, preparation: 0.1, section: "Ética", weight: 1 - lawWeight },
      {
        mastery: { answered: 8, correct: 6 },
        preparation: 0.4,
        section: "Direito",
        weight: lawWeight,
      },
    ],
    skills: [
      { area: "Ética", name: "Aplicar o Código de Ética", skillId: "s-ethics", topics: [] },
      { area: "Direito", name: "Situar a Constituição", skillId: "s-law", topics: [] },
    ],
    skippedAreas,
  });

  const law = syllabus.subjects.find((subject) => subject.name === "Direito");
  return { mastery: law?.mastery, preparation: law?.preparation, reason: law?.notPlannedReason };
}

function noticeSubjectOf(name: string, partOf: string | null, share: number) {
  return {
    group: null,
    name,
    partOf,
    questions: 5,
    share,
    shortName: null,
    topics: [],
    writtenTasks: [],
  };
}

describe("an exam subject out of the plan", () => {
  const ethics = lesson({ chapterId: "ch-ethics", skillId: "s-ethics" });
  const lawDone = lesson({ chapterId: "ch-law", skillId: "s-law", status: "done" });

  it("shows its preparation while the goal counts it: left out for time", () => {
    expect(readLaw({ items: [ethics], lawWeight: 0.3 })).toStrictEqual({
      mastery: { answered: 8, correct: 6 },
      preparation: 0.4,
      reason: "time",
    });
  });

  it("shows none when its sections weigh nothing in the goal", () => {
    expect(readLaw({ items: [ethics], lawWeight: 0 })).toStrictEqual({
      mastery: null,
      preparation: null,
      reason: "time",
    });
  });

  it("reads its preparation and mastery only from the sections the goal counts", () => {
    const languages = "Linguagens, Códigos e suas Tecnologias";
    const english = "Língua Inglesa";

    const syllabus = buildSyllabus({
      areaCourses: new Map(),
      chapterTitles: new Map(),
      items: [lesson({ chapterId: "ch-math", skillId: "s-math" })],
      knownSkillIds: new Set(),
      notice: {
        courseWeights: null,
        fromMaterial: false,
        passMarks: null,
        questionsSource: null,
        subjects: [
          noticeSubjectOf(languages, null, 0.5),
          noticeSubjectOf(english, languages, 0),
          noticeSubjectOf("Matemática", null, 0.5),
        ],
        url: null,
      },
      pastBasicsSkillIds: new Set(),
      sections: [
        { mastery: null, preparation: 0.2, section: "Linguagens", weight: 0.5 },
        { mastery: { answered: 8, correct: 6 }, preparation: 0.6, section: english, weight: 0 },
        { mastery: null, preparation: 0.1, section: "Matemática", weight: 0.5 },
      ],
      skills: [
        { area: "Linguagens", name: "Interpretar textos", skillId: "s-texts", topics: [] },
        { area: english, name: "Ler textos em inglês", skillId: "s-english", topics: [] },
        { area: "Matemática", name: "Usar proporções", skillId: "s-math", topics: [] },
      ],
      skippedAreas: [],
    });

    const left = syllabus.subjects.find((subject) => subject.name === languages);

    expect(left).toMatchObject({
      areas: ["Linguagens", english],
      mastery: null,
      notPlannedReason: "time",
      preparation: 0.2,
    });
  });

  it("shows none once the learner took it out, whatever they studied of it", () => {
    expect(
      readLaw({ items: [ethics, lawDone], lawWeight: 0.3, skippedAreas: ["Direito"] }),
    ).toStrictEqual({ mastery: null, preparation: null, reason: "skipped" });
  });
});
