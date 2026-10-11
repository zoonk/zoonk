import { type TestCase } from "@/lib/types";
import { type TranslatePassMarksParams } from "@zoonk/ai/tasks/v2/research/translate-pass-marks";
import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";

const SHARED_EXPECTATIONS = `
- \`language\` is the ISO 639-1 code of the texts' language, and \`translations\` has one entry for every other requested language, never one for the texts' own.
- Each entry translates every line, in order, one for one, in natural wording for that language.
- Every number, score and percentage is kept exactly; nothing is converted, rounded, added up or explained.
- Says only what each line says: no advice, no estimate of anyone's chances, no promise of a result.
- No em dashes and no Markdown.
`;

export const TEST_CASES: TestCase<unknown, TranslatePassMarksParams>[] = [
  {
    // A DELE B2 candidate learning in Portuguese saw this in Spanish on their exam page.
    expectations: `${SHARED_EXPECTATIONS}
- \`language\` is "es"; translations for en, pt, fr and de.
- Each says a minimum of 30 points in Group 1 and 30 points in Group 2 ("Grupo 1" becomes that language's word for group), and keeps the official grade "Apto" in quotation marks after its translation (Portuguese "Aprovado", English "Pass").`,
    id: "es-dele-b2-groups",
    userInput: {
      languages: SUPPORTED_LOCALES,
      texts: ["Apto con un mínimo de 30 puntos en el Grupo 1 y 30 puntos en el Grupo 2."],
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
- \`language\` is "pt"; translations for en, es, fr and de.
- Each says candidates pass the objective test with at least 50% right answers, that is a score of 40.00 points or more (the decimal written as that language writes it).`,
    id: "pt-oab-objective",
    userInput: {
      languages: SUPPORTED_LOCALES,
      texts: [
        "Aprovado na prova objetiva quem obtiver no mínimo 50% de acertos, ou seja, nota igual ou superior a 40,00 pontos.",
      ],
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
- \`language\` is "en"; translations for es, pt, fr and de, each with both lines.
- The first line keeps 60 of the 100 points; the second keeps the minimum of 20 points in each of the four tests, and keeps "Reading", "Listening", "Writing" and "Speaking" understandable (translated or kept as names).`,
    id: "en-two-pass-marks",
    userInput: {
      languages: SUPPORTED_LOCALES,
      texts: [
        "To pass, candidates need at least 60 of the 100 points.",
        "Candidates must also score at least 20 points in each of Reading, Listening, Writing and Speaking.",
      ],
    },
  },
];
