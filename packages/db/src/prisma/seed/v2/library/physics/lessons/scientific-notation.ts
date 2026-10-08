import { t } from "../../../_utils/localize";
import { option } from "../../content";
import { type SeedLesson } from "../../types";

/**
 * Chapter "Exponents and scientific notation", lesson 2: the math quantum physics leans on most.
 * One rule (count the jumps of the decimal point), a worked example with a real atom, a guess
 * that shows why the notation matters, then practice with less support.
 */
export const scientificNotationLesson: SeedLesson = {
  canDo: t(
    "You'll write the size of an atom and the distance to the Sun in a few characters.",
    "Você vai escrever o tamanho de um átomo e a distância até o Sol com poucos caracteres.",
  ),
  description: t(
    "Physics works with numbers too big and too small to write out. Scientific notation fits them in a few characters.",
    "A física usa números grandes e pequenos demais para escrever por extenso. A notação científica cabe em poucos caracteres.",
  ),
  key: "scientific-notation",
  minutes: 5,
  skills: ["sci-notation", "orders-of-magnitude"],
  steps: [
    {
      content: {
        text: t(
          "The Sun is **150,000,000,000** meters away. A hydrogen atom is **0.0000000001** meters wide. Miss a single zero and you're off by ten times.\n\nScientists write both in a few characters: $1.5 \\times 10^{11}$ m and $1 \\times 10^{-10}$ m. By the end of this lesson, so will you.",
          "O Sol está a **150.000.000.000** metros daqui. Um átomo de hidrogênio mede **0,0000000001** metro. Erre um único zero e a conta fica dez vezes errada.\n\nOs cientistas escrevem os dois com poucos caracteres: $1{,}5 \\times 10^{11}$ m e $1 \\times 10^{-10}$ m. No fim desta lição, você também.",
        ),
        variant: "text",
      },
      kind: "hook",
    },
    {
      content: {
        text: t(
          "Scientific notation writes a number as **a number from 1 to 10, times a power of ten**: $a \\times 10^n$.\n\nThe power $n$ counts how many places the decimal point jumps. Start from 150,000,000,000 and move the point 11 places to the left: you get 1.5. So it's $1.5 \\times 10^{11}$.",
          "A notação científica escreve um número como **um número de 1 a 10, vezes uma potência de dez**: $a \\times 10^n$.\n\nA potência $n$ conta quantas casas a vírgula pula. Parta de 150.000.000.000 e ande com a vírgula 11 casas para a esquerda: você chega a 1,5. Então fica $1{,}5 \\times 10^{11}$.",
        ),
        title: t("Count the jumps", "Conte os pulos"),
      },
      kind: "explanation",
      skill: "sci-notation",
    },
    {
      content: {
        text: t(
          "For numbers smaller than 1, the point jumps to the right and the power is negative. From 0.0000000001, it takes 10 jumps to reach 1, so it's $1 \\times 10^{-10}$.\n\nA negative power doesn't make a negative number. It means *small*: $10^{-10}$ is one ten-billionth.",
          "Para números menores que 1, a vírgula pula para a direita e a potência fica negativa. De 0,0000000001 até chegar a 1 são 10 pulos, então fica $1 \\times 10^{-10}$.\n\nPotência negativa não faz um número negativo. Ela quer dizer *pequeno*: $10^{-10}$ é um décimo de bilionésimo.",
        ),
        title: t("Small numbers, negative powers", "Números pequenos, potências negativas"),
      },
      kind: "explanation",
      skill: "sci-notation",
    },
    {
      content: {
        options: [
          option(
            "right",
            t("5.2 × 10⁻⁴", "5,2 × 10⁻⁴"),
            t(
              "The point jumps 4 places right to reach 5.2, so the power is −4.",
              "A vírgula pula 4 casas para a direita até 5,2, então a potência é −4.",
            ),
            true,
          ),
          option(
            "positive",
            t("5.2 × 10⁴", "5,2 × 10⁴"),
            t(
              "A positive power makes a big number: 52,000. Numbers below 1 need a negative power.",
              "Potência positiva faz um número grande: 52.000. Números menores que 1 precisam de potência negativa.",
            ),
          ),
          option(
            "front",
            t("52 × 10⁻⁵", "52 × 10⁻⁵"),
            t(
              "It's the same value, but the front number must be between 1 and 10. Move one more place: 5.2 × 10⁻⁴.",
              "O valor é o mesmo, mas o número da frente precisa estar entre 1 e 10. Ande mais uma casa: 5,2 × 10⁻⁴.",
            ),
          ),
          option(
            "count",
            t("5.2 × 10⁻³", "5,2 × 10⁻³"),
            t(
              "Count the jumps again: from 0.00052 to 5.2 is 4 places, not 3.",
              "Conte os pulos de novo: de 0,00052 até 5,2 são 4 casas, não 3.",
            ),
          ),
        ],
        question: t(
          "How do you write 0.00052 in scientific notation?",
          "Como fica 0,00052 em notação científica?",
        ),
      },
      kind: "check",
      skill: "sci-notation",
    },
    {
      content: {
        problem: t(
          "The hydrogen atom's radius is **0.000000000053 m**. Write it in scientific notation.",
          "O raio do átomo de hidrogênio é **0,000000000053 m**. Escreva em notação científica.",
        ),
        result: t(
          "5.3 × 10⁻¹¹ m. Far easier to read, and impossible to misread by a zero.",
          "5,3 × 10⁻¹¹ m. Muito mais fácil de ler, e sem chance de errar um zero.",
        ),
        steps: [
          {
            math: t(String.raw`0.000000000\underline{5}3`, String.raw`0{,}000000000\underline{5}3`),
            text: t(
              "Find the first digit that isn't zero: 5.",
              "Ache o primeiro algarismo diferente de zero: 5.",
            ),
          },
          {
            math: t("5.3", "5{,}3"),
            text: t("Put the decimal point right after it.", "Coloque a vírgula logo depois dele."),
          },
          {
            math: t(
              String.raw`0.000000000053 \to 5.3 \quad (11 \text{ jumps})`,
              String.raw`0{,}000000000053 \to 5{,}3 \quad (11 \text{ pulos})`,
            ),
            text: t(
              "Count how many places the point jumped to the right: 11.",
              "Conte quantas casas a vírgula pulou para a direita: 11.",
            ),
          },
          {
            math: t(
              String.raw`5.3 \times 10^{-11}\ \text{m}`,
              String.raw`5{,}3 \times 10^{-11}\ \text{m}`,
            ),
            text: t(
              "Jumping right means a small number, so the power is negative.",
              "Pular para a direita quer dizer número pequeno, então a potência é negativa.",
            ),
          },
        ],
        title: t("The size of a hydrogen atom", "O tamanho de um átomo de hidrogênio"),
      },
      kind: "workedExample",
      skill: "sci-notation",
    },
    {
      content: {
        check: {
          answer: 700_000,
          explanation: t(
            "7 × 10⁻⁵ m ÷ 1 × 10⁻¹⁰ m = 7 × 10⁵: about 700,000 atoms.",
            "7 × 10⁻⁵ m ÷ 1 × 10⁻¹⁰ m = 7 × 10⁵: cerca de 700.000 átomos.",
          ),
          kind: "numeric",
          question: t(
            "How many atoms fit across the hair?",
            "Quantos átomos cabem na largura do fio?",
          ),
          tolerance: { kind: "relative", value: 0.01 },
          unit: t("atoms", "átomos"),
        },
        fields: {
          comparison: t(
            "If each atom were a person, that's more people than live in Boston, lined up across one hair.",
            "Se cada átomo fosse uma pessoa, seria mais gente do que mora em Florianópolis, enfileirada na largura de um único fio.",
          ),
          expression: "7 * 10^(-5) / (1 * 10^(-10))",
          max: 1_000_000_000,
          min: 1,
          scale: "log",
          takeaway: t(
            "Dividing powers of ten means subtracting them: 10⁻⁵ ÷ 10⁻¹⁰ = 10⁵. So 7 × 10⁵ = 700,000.",
            "Dividir potências de dez é subtrair os expoentes: 10⁻⁵ ÷ 10⁻¹⁰ = 10⁵. Então 7 × 10⁵ = 700.000.",
          ),
          unit: t("atoms", "átomos"),
          workings: [
            { expression: "7 * 10^(-5)", label: t("Hair width (m)", "Largura do fio (m)") },
            { expression: "1 * 10^(-10)", label: t("Atom width (m)", "Largura do átomo (m)") },
            {
              expression: "7 * 10^(-5) / (1 * 10^(-10))",
              label: t("Atoms across", "Átomos lado a lado"),
            },
          ],
        },
        prompt: t(
          "A human hair is about 0.07 mm thick. Guess first: how many hydrogen atoms fit side by side across it?",
          "Um fio de cabelo tem cerca de 0,07 mm de espessura. Chute primeiro: quantos átomos de hidrogênio cabem lado a lado nele?",
        ),
        template: "estimateReveal",
      },
      kind: "activity",
      skill: "orders-of-magnitude",
    },
    {
      content: {
        options: [
          option(
            "bigger",
            t("3 × 10⁸", "3 × 10⁸"),
            t(
              "Compare the powers first: 10⁸ is ten times 10⁷. So 300,000,000 beats 90,000,000.",
              "Compare primeiro as potências: 10⁸ é dez vezes 10⁷. Então 300.000.000 ganha de 90.000.000.",
            ),
            true,
          ),
          option(
            "front",
            t("9 × 10⁷", "9 × 10⁷"),
            t(
              "9 is bigger than 3, but the powers matter more: 10⁸ is ten times 10⁷.",
              "9 é maior que 3, mas as potências pesam mais: 10⁸ é dez vezes 10⁷.",
            ),
          ),
          option(
            "equal",
            t("They're equal", "Eles são iguais"),
            t(
              "300,000,000 and 90,000,000 aren't equal: the first is more than three times the second.",
              "300.000.000 e 90.000.000 não são iguais: o primeiro é mais que o triplo do segundo.",
            ),
          ),
        ],
        question: t("Which is bigger: 3 × 10⁸ or 9 × 10⁷?", "Qual é maior: 3 × 10⁸ ou 9 × 10⁷?"),
      },
      kind: "check",
      skill: "orders-of-magnitude",
    },
    {
      content: {
        acceptedAnswers: ["3 × 10^8", "3 x 10^8", "3*10^8", "3 × 10⁸", "3e8"],
        keyPoints: [
          t("The front number is 3, between 1 and 10", "O número da frente é 3, entre 1 e 10"),
          t(
            "The point jumps 8 places, so the power is 8",
            "A vírgula pula 8 casas, então a potência é 8",
          ),
        ],
        question: t(
          "Light travels about 300,000,000 meters per second. Write that speed in scientific notation.",
          "A luz percorre cerca de 300.000.000 metros por segundo. Escreva essa velocidade em notação científica.",
        ),
        sampleAnswer: t(String.raw`$3 \times 10^8$ m/s`, String.raw`$3 \times 10^8$ m/s`),
      },
      kind: "typedAnswer",
      screen: "application",
      skill: "sci-notation",
    },
    {
      content: {
        ideas: [
          {
            text: t(
              "Scientific notation writes a number as a × 10ⁿ, with a between 1 and 10.",
              "A notação científica escreve um número como a × 10ⁿ, com a entre 1 e 10.",
            ),
          },
          {
            text: t(
              "The power counts how many places the decimal point jumps.",
              "A potência conta quantas casas a vírgula pula.",
            ),
          },
          {
            text: t(
              "Big numbers get positive powers; numbers below 1 get negative ones.",
              "Números grandes têm potência positiva; números menores que 1, negativa.",
            ),
          },
          {
            text: t(
              "To compare, look at the powers first: each step up is ten times bigger.",
              "Para comparar, olhe primeiro as potências: cada degrau a mais é dez vezes maior.",
            ),
          },
        ],
      },
      kind: "summary",
    },
  ],
  supportMode: "explanationFirst",
  title: t("Writing very big and very small numbers", "Escrevendo números enormes e minúsculos"),
};
