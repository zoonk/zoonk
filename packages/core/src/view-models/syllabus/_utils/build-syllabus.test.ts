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
  passMarks: [],
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

/** Will's old graph: areas named by their courses, no topics, and a study-strategy area. */
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

    // The chapter holding the plan's next lesson is the current one; its date is the next one.
    expect(portuguese?.chapters).toStrictEqual([
      {
        chapterId: "ch-ortho",
        lessonsDone: 1,
        lessonsTotal: 2,
        nextDate: "2026-10-07",
        position: 1,
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

    // Lessons still being written are named by their skill, not their course.
    expect(syllabus.subjects[3]?.chapters).toStrictEqual([
      {
        chapterId: null,
        lessonsDone: 0,
        lessonsTotal: 1,
        nextDate: null,
        position: 1,
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
      // A skill teaches it, but none of its lessons fit before the exam.
      ["Tempos verbais", "notPlanned", "time", null],
    ]);

    expect(portuguese?.topics[1]?.chapters.map((chapter) => chapter.chapterId)).toStrictEqual([
      "ch-cohesion",
    ]);

    // The same words in two subjects tick each subject's own skills.
    expect(
      constitutional?.topics.map((topic) => [topic.status, topic.chapters.length]),
    ).toStrictEqual([
      ["toStudy", 1],
      ["toStudy", 1],
    ]);

    expect(constitutional?.topics[1]?.chapters[0]?.chapterId).toBe("ch-rules");

    // Each subject numbers its own chapters from 1, as its page lists them.
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

    // A subject the learner took out says so on the subject and on every topic.
    expect(process?.notPlannedReason).toBe("skipped");

    expect(process?.topics.map((topic) => topic.notPlannedReason)).toStrictEqual([
      "skipped",
      "skipped",
    ]);
  });

  it("counts lessons still being written for a skill in the chapter that already teaches it", () => {
    const input = oldGraphInput();

    const syllabus = buildSyllabus({
      ...input,
      items: [
        ...input.items,
        lesson({
          chapterId: null,
          lessonId: null,
          scheduledFor: day("2026-10-09"),
          skillId: "s-ortho",
        }),
      ],
    });

    expect(syllabus.subjects[0]?.chapters).toStrictEqual([
      {
        chapterId: "ch-ortho",
        lessonsDone: 1,
        lessonsTotal: 3,
        nextDate: "2026-10-07",
        position: 1,
        state: "upcoming",
        title: "Grafia e acentuação",
        writing: false,
      },
    ]);
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

    // A notice subject no area of the plan teaches.
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

    // "1 Grafia" names no skill, but its "1.1 Ortografia" is in the plan: so is the heading.
    expect(statusOf("1 Grafia")).toStrictEqual(["inProgress", null]);
    expect(statusOf("1.2 Acentuação")).toStrictEqual(["notPlanned", "missing"]);

    // Taught by the constitutional subject's skill, whose lesson is to do.
    expect(statusOf("2 Coesão textual")).toStrictEqual(["toStudy", null]);

    // A heading nothing under it is in stays out.
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

    // A module the plan has skills for but no lessons in: they didn't fit.
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
        passMarks: [],
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

    // Today labels each lesson with the same name.
    expect(getSkillSubjects(withShortNames)).toStrictEqual(
      new Map([
        ["s-ortho", "Português"],
        ["s-const", "Direito Constitucional e Regimento"],
        ["s-process", "Processo Legislativo"],
        ["s-strategy", "Estratégia de prova"],
      ]),
    );
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

  /*
   * Carla's Journey read "Pesquisa com usuários · 3 de 169 aulas" next to "Prototipação e testes de
   * usabilidade · 0 de 6 aulas": the second module's lessons weren't written yet, and each item
   * standing in for a skill's lessons counted as one.
   */
  it("counts an item standing in for a skill's unwritten lessons as the lessons it plans", () => {
    const syllabus = buildSyllabus({
      areaCourses: new Map(),
      chapterTitles: new Map(),
      items: [
        lesson({ chapterId: "ch-research", skillId: "s-interview", status: "done" }),
        lesson({ chapterId: null, lessonId: null, skillId: "s-interview" }),
        lesson({ chapterId: null, lessonId: null, skillId: "s-prototype" }),
      ],
      notice: null,
      pastBasicsSkillIds: new Set(),
      skills: [
        {
          area: "Pesquisa com usuários",
          lessons: 12,
          name: "Conduzir entrevistas",
          skillId: "s-interview",
          topics: [],
        },
        {
          area: "Prototipação e testes de usabilidade",
          lessons: 30,
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
      ["pesquisa-com-usuarios", 1, 12],
      ["prototipacao-e-testes-de-usabilidade", 0, 30],
    ]);
  });

  /*
   * ENEM's notice was read again with its contents as topics ("Hereditariedade e diversidade da
   * vida") instead of the matrix's habilidades, which an earlier plan's skills name: its topics
   * show without a status, not all "not in the plan".
   */
  it("shows the topics of a subject planned from an earlier reading without a status", () => {
    const nature = "Ciências da Natureza e suas Tecnologias";

    const syllabus = buildSyllabus({
      areaCourses: new Map(),
      chapterTitles: new Map(),
      items: [lesson({ chapterId: "ch-genetics", skillId: "s-genetics" })],
      notice: {
        courseWeights: null,
        fromMaterial: false,
        passMarks: [],
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
      notice: {
        courseWeights: null,
        fromMaterial: false,
        passMarks: [],
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
});
