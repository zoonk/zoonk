import { type TestCase } from "@/lib/types";
import { type ChallengeCaseParams } from "@zoonk/ai/tasks/v2/challenge/case";

type ChallengeCaseInput = Omit<
  ChallengeCaseParams,
  "analytics" | "model" | "problems" | "reasoning" | "useFallback"
>;

export const TEST_CASES: TestCase<unknown, ChallengeCaseInput>[] = [
  {
    expectations: `A marketing or e-commerce analyst judging an A/B test before a meeting, where a colleague wants to ship now. The strong path checks whether the gap could be chance and how many visitors each version had, uses the AI or a data colleague to test significance, and explains the result in plain words. Numbers must be consistent (a small gap on a small sample shouldn't be called significant). Must not teach that a single day of data proves a winner.`,
    id: "en-ab-test-work",
    userInput: {
      chapterDescription: "Tell a real difference from chance in experiments like A/B tests.",
      chapterTitle: "Hypothesis testing",
      courseTitle: "Statistics",
      language: "en",
      level: "beginner",
      skills: [
        {
          description: "Decide whether a gap between two groups could be chance.",
          name: "Tell a real difference from chance",
        },
        {
          description: "Know how many observations a comparison needs.",
          name: "Choose a sample size",
        },
        {
          description: "Explain a test result to people who aren't data people.",
          name: "Explain a test result",
        },
      ],
      variant: "work",
    },
  },
  {
    expectations: `A light "E se?" scenario in Brazilian Portuguese about energy coming in packets (quanta), for example "E se a luz não viesse em pacotes?" or a curious situation with a lamp, a solar panel or a camera. Two decisions per path, playful, no formulas, no jargon beyond "quantum" explained simply. Must be scientifically correct at an overview level (no claims that quantum effects are magic or that observation needs a conscious observer).`,
    id: "pt-quantum-what-if",
    userInput: {
      chapterDescription: "A energia da luz e da matéria vem em pacotes chamados quanta.",
      chapterTitle: "O que é um quantum",
      courseTitle: "Física quântica",
      language: "pt",
      level: "overview",
      skills: [
        {
          description: "A energia vem em pacotes mínimos, não em qualquer quantidade.",
          name: "Explicar que a energia vem em pacotes",
        },
        {
          description: "A luz se comporta como onda e como partícula.",
          name: "Reconhecer a dualidade onda-partícula",
        },
      ],
      variant: "whatIf",
    },
  },
  {
    expectations: `A nursing case in Brazilian Portuguese on a hospital ward: checking a weight-based dose before giving it, with a physician, a pharmacist or a senior nurse and an AI assistant. The strong path double-checks the calculation and the prescription, and raises a doubt with the prescriber clearly and respectfully. Doses and units must be correct and consistent (mg/kg, mL). Must model safe practice: never give a dose that looks wrong without checking.`,
    id: "pt-nursing-dose-work",
    userInput: {
      chapterDescription: "Calcular e conferir doses de medicamentos por peso com segurança.",
      chapterTitle: "Cálculo de doses",
      courseTitle: "Farmacologia para enfermagem",
      language: "pt",
      level: "intermediate",
      skills: [
        {
          description: "Calcular a dose a partir do peso do paciente.",
          name: "Calcular dose por peso",
        },
        {
          description: "Conferir prescrição, unidade e via antes de administrar.",
          name: "Conferir a prescrição",
        },
        {
          description: "Levar uma dúvida ao médico de forma clara e segura.",
          name: "Comunicar uma dúvida ao médico",
        },
      ],
      variant: "work",
    },
  },
  {
    expectations: `A first-weeks case for someone new to data analysis (a career changer in a junior analyst role): a messy spreadsheet (duplicates, blanks, inconsistent dates or names) and a manager who needs numbers soon. The strong path inspects and cleans before summarizing, uses the AI assistant to speed up the work but checks what it produced, and tells the manager about the limits of the data. Numbers must add up after cleaning.`,
    id: "en-career-change-data-cleaning",
    userInput: {
      chapterDescription: "Find and fix the problems in real-world data before analyzing it.",
      chapterTitle: "Cleaning messy data",
      courseTitle: "Data analysis",
      language: "en",
      level: "beginner",
      skills: [
        {
          description: "Spot duplicates, blanks and inconsistent entries.",
          name: "Find problems in a data set",
        },
        {
          description: "Fix or remove bad rows and say what you changed.",
          name: "Clean data safely",
        },
        {
          description: "Check an AI assistant's output before using it.",
          name: "Check what AI produced",
        },
      ],
      variant: "work",
    },
  },
  {
    expectations: `The same statistics chapter as "en-ab-test-work", but for a learner who works in nursing: the case happens on a hospital ward, such as a nurse manager asked whether a new fall-prevention or hand-hygiene routine really lowered a rate between two units or two months, with colleagues a nursing ward works with (a charge nurse, an infection-control nurse, a unit manager) and an AI assistant. It must still train telling a real difference from chance, sample size and explaining the result, without marketing or A/B tests, and nursing knowledge must not decide the right choices. Numbers must be realistic and consistent (a small gap on few patients isn't called significant). General to the field: a fictional hospital, no real names, no personal details, and no path ends with harm to a patient.`,
    id: "en-statistics-field-nursing",
    userInput: {
      chapterDescription: "Tell a real difference from chance in experiments like A/B tests.",
      chapterTitle: "Hypothesis testing",
      courseTitle: "Statistics",
      field: "nursing",
      language: "en",
      level: "beginner",
      skills: [
        {
          description: "Decide whether a gap between two groups could be chance.",
          name: "Tell a real difference from chance",
        },
        {
          description: "Know how many observations a comparison needs.",
          name: "Choose a sample size",
        },
        {
          description: "Explain a test result to people who aren't data people.",
          name: "Explain a test result",
        },
      ],
      variant: "work",
    },
  },
  {
    expectations: `A work case in Brazilian Portuguese for a learner who works in retail: a store (a fictional name) deciding a promotion or a price change, where successive percentages and the margin decide what's right (for example "aumentar 20% e dar 20% de desconto" doesn't return to the original price, and a discount on the sale price eats the margin faster than it seems). Colleagues a store works with (the store manager, the buyer, the finance person) and an AI assistant that checks calculations when asked. Every number in reais is right and consistent across panels, messages and endings, written the Brazilian way (R$ 1.234,56). General to the field, with no real company.`,
    id: "pt-porcentagem-field-retail",
    userInput: {
      chapterDescription: "Aumentos, descontos e margens aplicados em sequência no comércio.",
      chapterTitle: "Porcentagem no dia a dia",
      courseTitle: "Matemática financeira",
      field: "retail",
      language: "pt",
      level: "beginner",
      skills: [
        {
          description:
            "Calcular o efeito de aumentos e descontos percentuais aplicados um após o outro.",
          name: "Aumentos e descontos sucessivos",
        },
        {
          description: "Calcular a margem de lucro sobre o preço de venda.",
          name: "Calcular a margem",
        },
      ],
      variant: "work",
    },
  },
];
