import { type TestCase } from "@/lib/types";
import { type LessonMarksParams } from "@zoonk/ai/tasks/lesson-marks";
import { type MarksLessonId, getMarksLesson } from "./written-lessons";

type MarksCaseInput = Pick<LessonMarksParams, "ideas" | "language" | "lessonTitle" | "screens">;

const SHARED_EXPECTATIONS = `
  - A screen "may get an icon" when its kind is \`explanation\` and \`hasVisual\` is false; no other screen has one. Such a screen goes without when its case has no concrete thing besides its idea's icon
  - A screen's icon is never its idea's icon (code already dropped one that was), and no two ideas share an icon (code dropped the later one)
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
      - In Brazilian Portuguese, for a total beginner in biology
      - The ideas are the stages of one cycle, so each icon shows what sets its stage apart: "G1" and "fase M" never both get a cell or a variant of one, and no two ideas show the same thing
      - Each screen's icon shows its own case, never its idea's: "Primeiro, crescer" doesn't repeat G1's icon, "Depois, copiar o manual" doesn't repeat fase S's (no DNA beside a DNA strip), "Últimos preparativos" doesn't repeat G2's
      - "Uma sequência que recomeça" walks through the whole cycle (G1, S, G2 and M), so it has no idea; "As três fases ativas" teaches the intérfase idea
      - About lines don't say what the cell does in each stage (grows, copies its DNA, prepares, divides)
    `,
    id: "pt-ciclo-celular",
  }),
  marksCase({
    expectations: `
      - In Brazilian Portuguese, for a total beginner in personal finance
      - "Juros" and "Juros sobre juros" never share an icon (not a coin on both), "Mesmo ritmo, ganho maior" and "Na bolsa" never share one (not a stock chart on both), and no two ideas show the same thing
      - Each screen's icon shows its own case, never its idea's icon
      - The "Juros sobre juros" about line doesn't say old gains also earn; "Reinvestir" doesn't say it's leaving the gain invested; "Na bolsa" doesn't say a stock can fall
    `,
    id: "pt-juros-sobre-juros",
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
      - In Brazilian Portuguese, an overview of quantum physics for beginners
      - The explanation right after the guess says the hydrogen's map stays the same, before the lesson names the cloud or the ground state, so it isn't about "Estado fundamental"
      - The "Estado fundamental" about line doesn't say hydrogen has no lower energy to reach; "Elétron inteiro num ponto" doesn't say a measurement finds the whole electron at one point
    `,
    id: "pt-eletron-nucleo",
  }),
  marksCase({
    expectations: `
      - In Brazilian Portuguese, an overview of quantum physics for beginners
      - The "Fóton e sua energia" about line doesn't say more energy means a shorter wavelength; "Regra do 1.240" doesn't give the division; "Vácuo e ar" doesn't say where the rule holds
    `,
    id: "pt-comprimento-de-onda",
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
