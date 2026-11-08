import { type TestCase } from "@/lib/types";
import { type GoalOpeningParams } from "@zoonk/ai/tasks/curriculum/goal-opening";

const SHARED_EXPECTATIONS = `
  - The output is one skill (the learner's first), the shared course that teaches it, and that skill's first chapter, with its lessons
  - The skill is where the whole path starts: it builds on nothing the path teaches, starts at the goal's own subject and is pitched at OWN_LEVEL and PURPOSE, never an introduction, overview of the field, history or "why it matters"
  - The course has the canonical title a catalog would use, never a title about this learner
  - The chapter teaches that skill at its level band, its first lesson starts on a concrete idea of the subject, every lesson is one idea of 2 to 5 minutes, and no two lessons teach the same thing
  - The skill's name, the objectives, the can-do lines and each lesson's skills are actions in the language's usual form, never orders to the learner; chapter and lesson titles are the canonical, searchable names of their topics, as a course outline names them
  - Don't evaluate JSON formatting
`;

export const TEST_CASES: TestCase<never, GoalOpeningParams>[] = [
  {
    expectations: `
      - MUST be in US English
      - A curious adult with no background wants the big picture: the overview level, plain words, no formulas
      - The first skill is the field's first big idea, such as what a black hole is and how one forms, not a tour of astronomy

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-black-holes-overview",
    userInput: {
      goal: "Understand black holes",
      language: "en",
      ownLevel: "none",
      purpose: "overview",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - The learner works in accounting and has a basic level: the first skill is the foundation their daily work builds on, in Brazilian practice (such as the elements of the patrimônio, or recording a lançamento by partidas dobradas in a plano de contas), taught through workplace examples, not a general business overview
      - The course is a catalog subject such as "Contabilidade", never "Contabilidade para o meu trabalho"

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-accounting-for-work",
    userInput: { goal: "Contabilidade", language: "pt", ownLevel: "basic", purpose: "work" },
  },
  {
    expectations: `
      - MUST be in US English
      - A career change into UX design from zero: the first skill is the target role's first hands-on foundation (such as finding a user's problem through an interview), not career advice, a portfolio or the history of design

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-ux-career-change",
    userInput: {
      goal: "Become a UX designer",
      language: "en",
      ownLevel: "none",
      purpose: "careerChange",
    },
  },
];
