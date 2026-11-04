import { type TestCase } from "@/lib/types";
import { type LessonSpecParams } from "@zoonk/ai/tasks/lesson-spec";
import { listPlannerTemplates } from "@zoonk/core/library/activities/writer-templates";
import { type LessonSpecExpected } from "./visual-test-cases";

const ACTIVITY_TEMPLATES: LessonSpecParams["activityTemplates"] = listPlannerTemplates();

const BROAD_EXPECTATIONS = `
  - A visual only where the learner would otherwise have to picture something to follow or to answer, questions included; every other screen stays text only, the opening scene included unless it shows something the learner needs to see
  - No decorative visual: no picture of a person or an everyday scene that shows nothing to see, no table that restates its sentence, no picture repeated with nothing new
  - Each teaching brief states its idea in a plain sentence with the concrete case that shows it, and plans a comparison only where it truly maps
  - The output is a list of lesson specs; estimated minutes are computed by code; don't evaluate JSON formatting
`;

type BroadCase = TestCase<LessonSpecExpected, LessonSpecParams>;

function broadCase({
  expectations,
  id,
  pictures,
  ...input
}: Omit<LessonSpecParams, "activityTemplates"> & {
  expectations: string;
  id: string;
  pictures: LessonSpecExpected["pictures"];
}): BroadCase {
  return {
    expectations: `${expectations}\n${BROAD_EXPECTATIONS}`,
    expected: { pictures },
    id: `broad-${id}`,
    userInput: { activityTemplates: ACTIVITY_TEMPLATES, ...input },
  };
}

export const BROAD_SAMPLE_CASES: BroadCase[] = [
  broadCase({
    chapterTitle: "Divisão celular",
    courseTitle: "Biologia",
    expectations: `
      - MUST be in Brazilian Portuguese, for beginners
      - The stages are something to see: the screens that teach them show the cell at each stage, and a question that asks which stage a cell is in shows that cell, without naming the stage
    `,
    id: "pt-mitose",
    language: "pt",
    lessonDescription: "Como uma célula se divide em duas células iguais, e as fases da mitose.",
    lessonTitle: "Mitose",
    level: "beginner",
    pictures: "some",
  }),
  broadCase({
    chapterTitle: "A Revolução Industrial",
    courseTitle: "História Geral",
    expectations: `
      - MUST be in Brazilian Portuguese, an overview with no formulas
      - A map or a machine is pictured only on a screen about where things were or how the machine looked; no pictures of factories or workers that only set a mood
    `,
    id: "pt-revolucao-industrial",
    language: "pt",
    lessonDescription: "Por que a industrialização começou na Inglaterra no século XVIII.",
    lessonTitle: "Por que a Revolução Industrial começou na Inglaterra",
    level: "overview",
    pictures: "any",
  }),
  broadCase({
    chapterTitle: "Custos do negócio",
    courseTitle: "Gestão de Pequenos Negócios",
    expectations: `
      - MUST be in Brazilian Portuguese, for beginners
      - Nothing here has to be seen: no pictures; a table or chart only where the learner compares costs across amounts made
    `,
    id: "pt-custos-fixos-variaveis",
    language: "pt",
    lessonDescription:
      "A diferença entre custos que não mudam com a produção e custos que crescem com ela.",
    lessonTitle: "Custos fixos e variáveis",
    level: "beginner",
    pictures: "none",
  }),
  broadCase({
    chapterTitle: "Circuitos elétricos",
    courseTitle: "Física: Eletricidade",
    expectations: `
      - MUST be in Brazilian Portuguese, intermediate
      - The circuits are something to see: the screens that teach series and parallel show each circuit, and a question about what happens when a bulb burns out shows its circuit without showing the answer
    `,
    id: "pt-circuitos-serie-paralelo",
    language: "pt",
    lessonDescription:
      "Como a corrente e a tensão se dividem em circuitos em série e em paralelo, e o que acontece quando uma lâmpada queima.",
    lessonTitle: "Circuitos em série e em paralelo",
    level: "intermediate",
    pictures: "some",
  }),
  broadCase({
    chapterTitle: "Ritmo",
    courseTitle: "Teoria Musical",
    expectations: `
      - MUST be in Brazilian Portuguese, for beginners who never read music
      - The note shapes and the stacked numbers are something to see: the screens that name a note or explain the time signature show them on a staff
    `,
    id: "pt-compassos",
    language: "pt",
    lessonDescription:
      "Como a música se organiza em compassos e o que significam os números da fórmula de compasso.",
    lessonTitle: "Compasso e fórmula de compasso",
    level: "beginner",
    pictures: "some",
  }),
  broadCase({
    chapterTitle: "Imunidade adaptativa",
    courseTitle: "Imunologia",
    expectations: `
      - MUST be in Brazilian Portuguese, advanced, with precise terms after the intuition
      - Clonal selection and expansion are something to see: where they're taught, a picture or a process template shows one lymphocyte's receptor matching the antigen and that cell multiplying
    `,
    id: "pt-selecao-clonal",
    language: "pt",
    lessonDescription:
      "Como um linfócito que reconhece um antígeno se multiplica e deixa células de memória.",
    lessonTitle: "Seleção clonal e memória imunológica",
    level: "advanced",
    pictures: "any",
  }),
  broadCase({
    chapterTitle: "Fazendo compras",
    courseTitle: "Alimentação Saudável",
    expectations: `
      - MUST be in Brazilian Portuguese, for beginners
      - The label's numbers are read from a table of its rows, never from a picture of a package; no picture of a shopper
    `,
    id: "pt-rotulo-nutricional",
    language: "pt",
    lessonDescription:
      "Como ler a tabela nutricional e a porção de um alimento para comparar produtos no mercado.",
    lessonTitle: "Como ler o rótulo nutricional",
    level: "beginner",
    pictures: "any",
  }),
  broadCase({
    chapterTitle: "Patrimônio",
    courseTitle: "Contabilidade",
    expectations: `
      - MUST be in Brazilian Portuguese, for a total beginner in accounting
      - Nothing here has to be seen: no pictures, the opening scene included; a table only where the learner compares items they couldn't keep in their head
      - A term is named after its everyday meaning is clear (what the business owns, what it owes), never defined in a clause of another sentence
    `,
    id: "pt-ativo-passivo",
    language: "pt",
    lessonDescription: "O que uma empresa tem e o que ela deve: ativos e passivos.",
    lessonTitle: "Ativo e passivo",
    level: "beginner",
    pictures: "none",
  }),
  broadCase({
    chapterTitle: "Orçamento pessoal",
    courseTitle: "Educação Financeira",
    expectations: `
      - MUST be in Brazilian Portuguese, for a total beginner whose goal is to stay out of debt
      - A purchase on credit is spending on the day it's made: paying the bill later pays what was already spent and isn't a second expense
      - MUST NOT teach that a purchase on credit only becomes an expense when the bill is paid, or that it doesn't count until money leaves the account
    `,
    id: "pt-receitas-despesas",
    language: "pt",
    lessonDescription:
      "O dinheiro que entra e o que sai: receitas e despesas no orçamento de casa.",
    lessonTitle: "Receitas e despesas",
    level: "beginner",
    pictures: "any",
  }),
  broadCase({
    chapterTitle: "Ligações químicas",
    courseTitle: "Química",
    expectations: `
      - MUST be in Brazilian Portuguese, for beginners
      - Shells and shared pairs are something to see: the screens that introduce them show the atom or the molecule, and a question that counts electrons in shells or in a shared pair shows the atom or molecule it asks about, without showing the answer
    `,
    id: "pt-eletrons-valencia",
    language: "pt",
    lessonDescription:
      "Os elétrons da camada mais externa e como eles formam ligações entre átomos.",
    lessonTitle: "Átomos e elétrons de valência",
    level: "beginner",
    pictures: "some",
  }),
  broadCase({
    chapterTitle: "Acids and bases",
    courseTitle: "Chemistry",
    expectations: `
      - MUST be in US English, for beginners
      - The scale is something to read: a number line, a chart or a table where the learner places substances on it; no picture of a kitchen or a lemon
    `,
    id: "en-ph-scale",
    language: "en",
    lessonDescription: "What the pH scale measures and how to tell acids from bases.",
    lessonTitle: "The pH scale",
    level: "beginner",
    pictures: "any",
  }),
  broadCase({
    chapterTitle: "Arguments",
    courseTitle: "Logic and Critical Thinking",
    expectations: `
      - MUST be in US English, intermediate
      - Nothing here has to be seen: no pictures; arguments are written as text
    `,
    id: "en-valid-sound",
    language: "en",
    lessonDescription:
      "The difference between an argument whose conclusion follows and one that is also true.",
    lessonTitle: "Valid and sound arguments",
    level: "intermediate",
    pictures: "none",
  }),
  broadCase({
    chapterTitle: "Markets",
    courseTitle: "Economics Basics",
    expectations: `
      - MUST be in US English, for beginners
      - How price meets quantity is a chart or a formula model where the learner reads it; no picture of a market stall or a shopper
    `,
    id: "en-supply-demand",
    language: "en",
    lessonDescription: "Why prices rise and fall when supply or demand changes.",
    lessonTitle: "Supply and demand",
    level: "beginner",
    pictures: "any",
  }),
  broadCase({
    chapterTitle: "How the internet finds things",
    courseTitle: "Computer Networks",
    expectations: `
      - MUST be in US English, intermediate
      - The chain of lookups is a process to see: where it's taught, a process template or a diagram shows each server asked in turn
    `,
    id: "en-dns",
    language: "en",
    lessonDescription: "How a domain name is turned into an IP address, step by step.",
    lessonTitle: "How DNS resolves a name",
    level: "intermediate",
    pictures: "any",
  }),
  broadCase({
    chapterTitle: "The Renaissance",
    courseTitle: "Art History",
    expectations: `
      - MUST be in US English, an overview with no formulas
      - Perspective is something to see: the screens about the vanishing point and the horizon line show a painting or drawing with them marked
    `,
    id: "en-linear-perspective",
    language: "en",
    lessonDescription: "How Renaissance painters made flat pictures look deep.",
    lessonTitle: "Linear perspective",
    level: "overview",
    pictures: "some",
  }),
  broadCase({
    chapterTitle: "Enzymes",
    courseTitle: "Biochemistry",
    expectations: `
      - MUST be in US English, advanced, with correct notation
      - The saturation curve is something to read: a chart or a formula model shows speed flattening toward Vmax, with Km at half of it
    `,
    id: "en-michaelis-menten",
    language: "en",
    lessonDescription:
      "How reaction speed depends on substrate concentration, and what Km and Vmax mean.",
    lessonTitle: "Michaelis-Menten kinetics",
    level: "advanced",
    pictures: "any",
  }),
  broadCase({
    chapterTitle: "Everyday injuries",
    courseTitle: "First Aid",
    expectations: `
      - MUST be in US English, for beginners
      - The skin's layers are something to see: the screen that explains how deep a burn goes shows them; no picture of someone cooking or of a kitchen
    `,
    id: "en-burns-first-aid",
    language: "en",
    lessonDescription: "How to tell how serious a burn is and what to do in the first minutes.",
    lessonTitle: "First aid for burns",
    level: "beginner",
    pictures: "some",
  }),
];
