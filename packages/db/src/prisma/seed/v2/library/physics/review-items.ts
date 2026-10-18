import { t } from "../../_utils/localize";
import { bankOption } from "../content";
import { type SeedItem } from "../types";

/**
 * Quick questions for skills learners meet before the written lessons, so their capsules have
 * something to ask: the math of phase 1 and the light chapter of the overview.
 */
export const physicsReviewItems: SeedItem[] = [
  {
    content: {
      context: null,
      isTrue: true,
      misconception: null,
      reason: t(
        "3 divided by 4 is 0.75, so the fraction and the decimal are the same number.",
        "3 dividido por 4 é 0,75, então a fração e o decimal são o mesmo número.",
      ),
      statement: t("3/4 and 0.75 are the same number.", "3/4 e 0,75 são o mesmo número."),
    },
    difficulty: -1,
    format: "trueFalse",
    key: "three-quarters",
    skill: "fractions",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(t("12", "12"), t("0.3 × 40 = 12.", "0,3 × 40 = 12.")),
        bankOption(
          t("30", "30"),
          t(
            "30 is the percent itself. Multiply 40 by 0.3.",
            "30 é a própria porcentagem. Multiplique 40 por 0,3.",
          ),
          t(
            "Answered with the percent instead of taking it",
            "Respondeu com a porcentagem em vez de calculá-la",
          ),
        ),
        bankOption(
          t("28", "28"),
          t(
            "28 is what's left after taking 30% away, not 30% of 40.",
            "28 é o que sobra depois de tirar 30%, não 30% de 40.",
          ),
          t(
            "Took the percent away instead of taking the percent of",
            "Tirou a porcentagem em vez de calcular a porcentagem de",
          ),
        ),
        bankOption(
          t("1.2", "1,2"),
          t("That's 3% of 40. 30% is ten times more.", "Isso é 3% de 40. 30% é dez vezes mais."),
          t("Moved the decimal point one place too far", "Andou com a vírgula uma casa a mais"),
        ),
      ],
      question: t("What is 30% of 40?", "Quanto é 30% de 40?"),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "thirty-percent",
    skill: "percent-of",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t("0.001", "0,001"),
          t(
            "10⁻³ is 1 divided by 10³: 1 ÷ 1,000 = 0.001.",
            "10⁻³ é 1 dividido por 10³: 1 ÷ 1.000 = 0,001.",
          ),
        ),
        bankOption(
          t("−1,000", "−1.000"),
          t(
            "A negative power makes a small number, never a negative one.",
            "Potência negativa faz um número pequeno, nunca um número negativo.",
          ),
          t(
            "Thinks a negative power makes a negative number",
            "Acha que potência negativa faz um número negativo",
          ),
        ),
        bankOption(
          t("−30", "−30"),
          t(
            "The power isn't multiplied by 10: it counts how many times 10 divides.",
            "A potência não se multiplica por 10: ela conta quantas vezes o 10 divide.",
          ),
          t("Multiplied the base by the power", "Multiplicou a base pela potência"),
        ),
      ],
      question: t("What is 10⁻³?", "Quanto é 10⁻³?"),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "negative-power",
    skill: "powers-of-ten",
  },
  {
    content: {
      context: null,
      isTrue: true,
      misconception: null,
      reason: t(
        "Red light has the longest waves we can see and violet the shortest; the wavelength sets the color.",
        "A luz vermelha tem as ondas mais longas que enxergamos e a violeta, as mais curtas; o comprimento de onda define a cor.",
      ),
      statement: t(
        "The color of light depends on its wavelength.",
        "A cor da luz depende do seu comprimento de onda.",
      ),
    },
    difficulty: -1,
    format: "trueFalse",
    key: "color-wavelength",
    skill: "light-wave",
  },
];
