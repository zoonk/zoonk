import { type Prisma } from "../../generated/prisma/client";

/** Where a fixture's graph comes from: a goal's plan, or courses a career graph is built from. */
export type FixtureSource =
  | { about: string; goal: Prisma.GoalWhereInput; kind: "goal"; name: string }
  | {
      about: string;
      kind: "courses";
      language: string;
      name: string;
      phases: { courses: string[]; name: string; outcome?: boolean }[];
    };

/**
 * The fixtures and where they come from: the exams behind persona pass 10's learners, the seeded
 * language goal, a career goal from the shared UX courses (no seeded learner has one), and an
 * IELTS goal whose exam has listening. The class test (`class-test.json`) is rebuilt from persona
 * Pedro's notes, whose private content left with him, so it isn't exported.
 */
export const SOURCES: FixtureSource[] = [
  {
    about:
      "ENEM for Medicina at UFMG: the exam's skill graph, notice, topic frequency and the course's weights",
    goal: {
      details: { equals: "found", path: ["courseWeights", "status"] },
      examBlueprint: { identityKey: "enem" },
    },
    kind: "goal",
    name: "enem",
  },
  {
    about: "OAB Exame de Ordem, 1ª fase: the exam's skill graph and notice (20 subjects)",
    goal: { examBlueprint: { identityKey: { startsWith: "oab-exame-de-ordem" } } },
    kind: "goal",
    name: "oab",
  },
  {
    about:
      "Câmara dos Deputados, analista legislativo (registro e redação): the exam's skill graph and notice",
    goal: { examBlueprint: { identityKey: { startsWith: "camara-dos-deputados" } } },
    kind: "goal",
    name: "camara",
  },
  {
    about: "English for moving to Toronto, A2 to B1+: the seeded language goal's graph and lessons",
    goal: { kind: "language" },
    kind: "goal",
    name: "language",
  },
  {
    about:
      "A career change into UX: the shared UX courses' skills, the portfolio and the job search last as the goal's outcome",
    kind: "courses",
    language: "pt",
    name: "career",
    phases: [
      { courses: ["Pesquisa com usuários"], name: "Pesquisa" },
      { courses: ["Arquitetura da informação", "Design de interação"], name: "Estrutura e fluxos" },
      {
        courses: ["Design de interfaces digitais", "Prototipação de interfaces"],
        name: "Interfaces",
      },
      { courses: ["Avaliação de usabilidade"], name: "Testes" },
      { courses: ["Design de experiência do usuário"], name: "Processo de UX" },
      { courses: ["Portfólio de UX"], name: "Portfólio", outcome: true },
      { courses: ["Carreira em UX"], name: "Busca de emprego", outcome: true },
    ],
  },
  {
    about:
      "IELTS Academic: the exam's skill graph, with Listening skills practiced only with its recordings",
    goal: { examBlueprint: { identityKey: "r7-listening-ielts-academic" } },
    kind: "goal",
    name: "ielts",
  },
];
