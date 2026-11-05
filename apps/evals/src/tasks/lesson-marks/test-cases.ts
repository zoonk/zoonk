import { type TestCase } from "@/lib/types";
import { type LessonMarksParams } from "@zoonk/ai/tasks/lesson-marks";
import { type MarksLessonId, getMarksLesson } from "./written-lessons";

type MarksCaseInput = Pick<LessonMarksParams, "ideas" | "language" | "lessonTitle" | "screens">;

const SHARED_EXPECTATIONS = `
  - A screen "may get an icon" when its kind is \`explanation\` and \`hasVisual\` is false; every such screen has an icon and no other screen does
  - Quotes were already checked by code: judge only whether each kept underline and example is the right part of its screen
  - Icon names and descriptions are in English whatever the lesson's language; about lines are in the lesson's language
  - Don't evaluate JSON formatting
`;

function marksCase({
  expectations,
  id,
}: {
  expectations: string;
  id: MarksLessonId;
}): TestCase<never, MarksCaseInput> {
  const { level: _level, ...input } = getMarksLesson(id);

  return { expectations: `${expectations}\n${SHARED_EXPECTATIONS}`, id, userInput: input };
}

export const TEST_CASES = [
  marksCase({
    expectations: `
      - In Brazilian Portuguese, for a total beginner in accounting
      - The "Ativo" about line doesn't say it's what the company controls or what brings benefits; "Passivo" doesn't say it's an obligation or a debt; "Compra planejada" doesn't say a planned purchase creates no liability
      - Icons show the screens' own cases (the business's goods, a loan, an invoice), not a generic balance sheet on every screen
    `,
    id: "pt-ativo-passivo",
  }),
  marksCase({
    expectations: `
      - In Brazilian Portuguese, for a total beginner
      - The "Empréstimo" about line doesn't say a loan isn't income; "Ganho ocasional" doesn't say a gift is income; "Contas próprias" doesn't say a transfer between your own accounts is neither
      - The light bill, the salary, the loan and the gift each get the object of their own case
    `,
    id: "pt-receitas-despesas",
  }),
  marksCase({
    expectations: `
      - In Brazilian Portuguese, for beginners in chemistry
      - Every explanation here has its own picture or visual, so no screen gets an icon, while every idea still has one
      - "Elétrons de valência" about line doesn't say they're the outermost shell's; "Elétrons e ligações" doesn't give oxygen's 6 electrons or its two bonds
    `,
    id: "pt-eletrons-valencia",
  }),
  marksCase({
    expectations: `
      - In Brazilian Portuguese, for a total beginner
      - The "Renda líquida" about line doesn't say it's the gross minus deductions, and "Contas depois" doesn't say a bill paid later leaves net pay unchanged
    `,
    id: "pt-renda-bruta-liquida",
  }),
  marksCase({
    expectations: `
      - In Brazilian Portuguese, a law lesson for the OAB exam
      - About lines name each purpose's topic without listing what the statute says it includes
      - Icons are generic legal or civic objects tied to each screen's case, never the OAB's logo or a flag
    `,
    id: "pt-finalidades-oab",
  }),
  marksCase({
    expectations: `
      - In Brazilian Portuguese, intermediate math
      - About lines don't give the rule (direct or inverse proportion, multiply by the ratio) away
      - Icons never show numbers or formulas
    `,
    id: "pt-regra-de-tres",
  }),
  marksCase({
    expectations: `
      - In Spanish (Mexico), for beginners in economics
      - "No todos suben" about line doesn't say not every price has to rise; "Más pesos" doesn't say more pesos don't guarantee buying more
    `,
    id: "es-inflacion",
  }),
  marksCase({
    expectations: `
      - In German, for beginners in biology
      - "Sauerstoff entsteht" about line doesn't say oxygen is made; "Nachts ohne Licht" doesn't say the plant uses stored sugar at night
    `,
    id: "de-fotosynthese",
  }),
  marksCase({
    expectations: `
      - In Japanese, for beginners in physics
      - Every explanation has its own visual, so no screen gets an icon; every idea has one
      - "支点からの距離" about line doesn't say moving the effort farther from the fulcrum takes less force
    `,
    id: "ja-teko",
  }),
  marksCase({
    expectations: `
      - In US English, for beginners
      - "Getting back" about line doesn't say the rise back is a bigger percent
    `,
    id: "en-percent-change",
  }),
  marksCase({
    expectations: `
      - In US English, advanced quantum physics
      - About lines don't state the energies, the boundary values or the photon's wavelength
      - Icons stay concrete (a box, a wave, a photon), never an equation
    `,
    id: "en-particle-in-a-box",
  }),
  marksCase({
    expectations: `
      - In US English, a beginner programming lesson
      - "Reach 5" about line doesn't say range(1, 6) stops before 6
    `,
    id: "en-python-range",
  }),
  marksCase({
    expectations: `
      - In US English, for beginners in biology
      - About lines don't say which chambers receive or pump blood
    `,
    id: "en-heart-chambers",
  }),
];
