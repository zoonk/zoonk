import { type TestCase } from "@/lib/types";
import { type WriteItemSetParams } from "@zoonk/ai/tasks/v2/items/write-set";
import { CEBRASPE, ENEM, JEE_ADVANCED } from "../generate-items/test-cases";

type WriteItemSetInput = Omit<WriteItemSetParams, "model" | "useFallback" | "reasoning">;

const IELTS_ACADEMIC = {
  name: "IELTS Academic Reading",
  optionCount: 3,
  style:
    "A long academic passage followed by question groups; True/False/Not Given statements are answered with the same three options in that order: TRUE if the statement agrees with the passage, FALSE if it contradicts it, NOT GIVEN if the passage doesn't say.",
};

export const TEST_CASES: TestCase<unknown, WriteItemSetInput>[] = [
  {
    expectations: `One ENEM Linguagens set in Brazilian Portuguese: an original text (a chronicle, an opinion piece or a report, never attributed to a real author or outlet) and 3 multiple-choice questions with 5 options each that need it: its main idea, an inference and the effect of a language choice. Distractors come from reading mistakes. Every question's evidence is copied from the text.`,
    id: "pt-enem-linguagens-texto-tres-questoes",
    userInput: {
      examFormat: ENEM,
      format: "multipleChoice",
      language: "pt",
      questionCount: 3,
      skills: [
        {
          description:
            "Identificar a tese ou a ideia central de um texto argumentativo ou jornalístico.",
          level: "intermediate",
          name: "Ideia central do texto",
        },
        {
          description:
            "Inferir informações implícitas e o efeito de sentido de escolhas linguísticas.",
          level: "intermediate",
          name: "Inferência e efeitos de sentido",
        },
      ],
    },
  },
  {
    expectations: `One Cebraspe set in Brazilian Portuguese on administrative law: an original hypothetical case (a public servant, an agency, an administrative act) and 4 statements judged Certo or Errado that need the case, about half true, with Cebraspe-style traps (a swapped concept, a wrong exception, an absolute word). No real law is misquoted: when a statement relies on a rule, it is the rule as Brazilian law states it.`,
    id: "pt-cebraspe-caso-atos-administrativos",
    userInput: {
      examFormat: CEBRASPE,
      format: "trueFalse",
      language: "pt",
      questionCount: 4,
      skills: [
        {
          description: "Distinguir anulação e revogação de atos administrativos e seus efeitos.",
          level: "intermediate",
          name: "Anulação e revogação",
        },
        {
          description:
            "Reconhecer os atributos do ato administrativo: presunção de legitimidade, imperatividade e autoexecutoriedade.",
          level: "intermediate",
          name: "Atributos do ato administrativo",
        },
      ],
    },
  },
  {
    expectations: `One IELTS Academic Reading set in English: an original academic passage of 250 to 350 words and 4 True/False/Not Given statements, each a multiple-choice question whose options are exactly TRUE, FALSE and NOT GIVEN in that order with fixedOrder true, including at least one NOT GIVEN whose key is right because the passage doesn't say. Evidence is copied from the passage.`,
    id: "en-ielts-academic-true-false-not-given",
    userInput: {
      examFormat: IELTS_ACADEMIC,
      format: "multipleChoice",
      language: "en",
      questionCount: 4,
      skills: [
        {
          description:
            "Tell whether a statement agrees with, contradicts or isn't covered by an academic text.",
          level: "advanced",
          name: "Identifying information (True/False/Not Given)",
        },
      ],
    },
  },
  {
    expectations: `One JEE Advanced paragraph-based physics set in English: one original experiment or setup (for example blocks on an incline joined over a pulley, then sliding onto a spring), stated once with every number the questions need, in SI units, and 3 single-answer multiple-choice questions with 4 options, one per skill (kinematics, Newton's laws, work and energy), each needing a different part of the setup. Every key follows from the stated numbers, the numbers agree across the questions (a speed one question computes is the speed the next one uses), and each wrong option comes from a real mistake (time to a mark instead of between marks, net force taken as friction, friction left out of an energy balance). Difficulty matches JEE Advanced's own paragraph questions, not a textbook's: each question needs several steps that combine at least two ideas (a result from one stage of the setup feeding the next, or two laws applied together), so no question is a single formula with numbers stated next to each other.`,
    id: "en-jee-advanced-physics-case",
    userInput: {
      examFormat: JEE_ADVANCED,
      format: "multipleChoice",
      language: "en",
      questionCount: 3,
      skills: [
        {
          description:
            "Describe straight-line motion with displacement, velocity and constant acceleration, and solve problems with the equations of motion.",
          level: "advanced",
          name: "Kinematics in one dimension",
        },
        {
          description:
            "Apply Newton's three laws to blocks, pulleys and inclines, with friction and free-body diagrams.",
          level: "advanced",
          name: "Newton's laws of motion",
        },
        {
          description:
            "Use work, kinetic and potential energy and power, and the work-energy theorem, in mechanics problems.",
          level: "advanced",
          name: "Work, energy and power",
        },
      ],
    },
  },
];
