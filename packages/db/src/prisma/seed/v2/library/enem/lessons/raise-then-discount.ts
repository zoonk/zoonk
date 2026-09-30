import { t } from "../../../_utils/localize";
import { guess, option } from "../../content";
import { type SeedLesson } from "../../types";

/**
 * Percentages chapter, lesson 3: ENEM's classic trap. A guess exposes the intuition that +10% and
 * −10% cancel, multipliers replace it, and a slider shows the loss growing with the size of the change.
 */
export const raiseThenDiscountLesson: SeedLesson = {
  canDo: t(
    "You'll see through the “raise, then discount” trap and find the final price in one multiplication.",
    "Você vai desarmar a pegadinha do “aumento seguido de desconto” e achar o preço final numa multiplicação.",
  ),
  description: t(
    "Why a 10% raise followed by a 10% discount doesn't bring a price back to where it started.",
    "Por que um aumento de 10% seguido de um desconto de 10% não traz o preço de volta ao início.",
  ),
  key: "raise-then-discount",
  minutes: 5,
  skills: ["percent-factor", "successive-percent"],
  steps: [
    {
      content: {
        options: [
          guess("same", t("The same as the original", "Igual ao original")),
          guess("higher", t("Higher than the original", "Maior que o original")),
          guess("lower", t("Lower than the original", "Menor que o original"), true),
        ],
        question: t(
          "A store raises a price by 10%, then gives 10% off the new price. The final price is:",
          "Uma loja aumenta um preço em 10% e depois dá 10% de desconto sobre o novo preço. O preço final fica:",
        ),
        reveal: t(
          "Lower, by 1%. The discount is taken from a bigger price, so it removes more than the raise added.",
          "Menor, em 1%. O desconto é tirado de um preço maior, então remove mais do que o aumento colocou.",
        ),
        variant: "guess",
      },
      kind: "hook",
    },
    {
      content: {
        text: t(
          "Turn every percent change into the number that multiplies the price:\n\n- +10% is × **1.1** (100% plus 10%)\n- −10% is × **0.9** (100% minus 10%)\n- +25% is × 1.25, −20% is × 0.8\n\nOnce each change is a multiplier, a chain of changes is a chain of multiplications.",
          "Transforme cada variação no número que multiplica o preço:\n\n- +10% é × **1,1** (100% mais 10%)\n- −10% é × **0,9** (100% menos 10%)\n- +25% é × 1,25, −20% é × 0,8\n\nCom cada variação virando um fator, uma sequência de variações é uma sequência de multiplicações.",
        ),
        title: t("Every percent change is a multiplier", "Toda variação percentual é um fator"),
      },
      kind: "explanation",
      skill: "percent-factor",
    },
    {
      content: {
        options: [
          option(
            "increase",
            t("0.15", "0,15"),
            t(
              "That's only the increase. You keep the whole 100% and add 15% on top.",
              "Esse é só o aumento. Você mantém os 100% e soma 15% em cima.",
            ),
          ),
          option(
            "factor",
            t("1.15", "1,15"),
            t("100% + 15% = 115% = 1.15.", "100% + 15% = 115% = 1,15."),
            true,
          ),
          option(
            "drop",
            t("0.85", "0,85"),
            t("That's a 15% drop: 100% − 15%.", "Essa é uma queda de 15%: 100% − 15%."),
          ),
          option(
            "fifteen",
            t("15", "15"),
            t(
              "Multiplying by 15 would make the price fifteen times bigger.",
              "Multiplicar por 15 deixaria o preço quinze vezes maior.",
            ),
          ),
        ],
        question: t(
          "What do you multiply a price by to raise it by 15%?",
          "Por quanto você multiplica um preço para aumentá-lo em 15%?",
        ),
      },
      kind: "check",
      skill: "percent-factor",
    },
    {
      content: {
        problem: t(
          "A product costs R$ 200. It goes up 10%, then down 10%. How much does it cost in the end?",
          "Um produto custa R$ 200. Ele sobe 10% e depois cai 10%. Quanto custa no final?",
        ),
        result: t(
          "R$ 198, 1% less than it started. The 10% off came from R$ 220, so it removed R$ 22, more than the R$ 20 the raise added.",
          "R$ 198, 1% a menos que no início. Os 10% de desconto saíram de R$ 220, então tiraram R$ 22, mais que os R$ 20 do aumento.",
        ),
        steps: [
          {
            math: t(
              String.raw`+10\% \to 1.1 \qquad -10\% \to 0.9`,
              String.raw`+10\% \to 1{,}1 \qquad -10\% \to 0{,}9`,
            ),
            text: t(
              "Turn each change into its multiplier.",
              "Transforme cada variação no seu fator.",
            ),
          },
          {
            math: t(String.raw`1.1 \times 0.9 = 0.99`, String.raw`1{,}1 \times 0{,}9 = 0{,}99`),
            text: t("Multiply the multipliers.", "Multiplique os fatores."),
          },
          {
            math: t(String.raw`200 \times 0.99 = 198`, String.raw`200 \times 0{,}99 = 198`),
            text: t("Apply the result to the price.", "Aplique o resultado ao preço."),
          },
        ],
        title: t("Up 10%, down 10%", "Sobe 10%, cai 10%"),
      },
      kind: "workedExample",
      skill: "successive-percent",
    },
    {
      content: {
        check: {
          answer: 96,
          explanation: t(
            "1.2 × 0.8 = 0.96, so R$ 100 ends at R$ 96. The bigger the change, the bigger the loss: at 50% it's R$ 75.",
            "1,2 × 0,8 = 0,96, então R$ 100 terminam em R$ 96. Quanto maior a variação, maior a perda: com 50% são R$ 75.",
          ),
          inputs: [{ name: "change", value: 20 }],
          kind: "numeric",
          question: t(
            "A price of R$ 100 goes up 20%, then down 20%. What does it end at?",
            "Um preço de R$ 100 sobe 20% e depois cai 20%. Em quanto ele termina?",
          ),
          tolerance: { kind: "absolute", value: 0.01 },
          unit: "R$",
        },
        data: { isExample: true },
        fields: {
          compareAt: 10,
          formula: "100 * (1 + change / 100) * (1 - change / 100)",
          output: { label: t("Final price", "Preço final"), unit: "R$" },
          variable: {
            initial: 10,
            label: t("Up, then down by", "Sobe e depois cai"),
            max: 50,
            min: 0,
            name: "change",
            step: 5,
            unit: "%",
          },
        },
        prompt: t(
          "A price of R$ 100 goes up by some percent, then down by the same percent. Slide it and watch where it ends.",
          "Um preço de R$ 100 sobe uma porcentagem e depois cai a mesma porcentagem. Deslize e veja onde ele termina.",
        ),
        template: "sliderGraph",
      },
      kind: "activity",
      skill: "successive-percent",
    },
    {
      content: {
        context: t(
          "In January, the price of gasoline at a station rose 20%. In February, it fell 20%.",
          "Em janeiro, o preço da gasolina num posto subiu 20%. Em fevereiro, caiu 20%.",
        ),
        options: [
          option(
            "a",
            t("the same", "igual"),
            t(
              "The 20% drop came off a bigger price, so it removed more than the rise added.",
              "A queda de 20% saiu de um preço maior, então tirou mais do que o aumento colocou.",
            ),
          ),
          option(
            "b",
            t("4% lower", "4% menor"),
            t(
              "1.2 × 0.8 = 0.96: 4% below where it started.",
              "1,2 × 0,8 = 0,96: 4% abaixo do início.",
            ),
            true,
          ),
          option(
            "c",
            t("4% higher", "4% maior"),
            t(
              "The size is right, but 0.96 is below 1, so the price went down.",
              "O tamanho está certo, mas 0,96 é menor que 1, então o preço caiu.",
            ),
          ),
          option(
            "d",
            t("0.4% lower", "0,4% menor"),
            t(
              "The loss is 0.2 × 0.2 = 0.04, which is 4%, not 0.4%. Check where the decimal point goes.",
              "A perda é 0,2 × 0,2 = 0,04, ou seja, 4%, não 0,4%. Confira onde fica a vírgula.",
            ),
          ),
          option(
            "e",
            t("20% lower", "20% menor"),
            t(
              "That looks only at February and forgets January's rise.",
              "Isso olha só para fevereiro e esquece o aumento de janeiro.",
            ),
          ),
        ],
        question: t(
          "Compared with the start of January, the price at the end of February is:",
          "Em relação ao início de janeiro, o preço no fim de fevereiro está:",
        ),
      },
      kind: "check",
      screen: "application",
      skill: "successive-percent",
    },
    {
      content: {
        text: t(
          "Raise then discount, or discount then raise: 1.1 × 0.9 is the same as 0.9 × 1.1. Either way you end at 99%.\n\nWhat changes the result is the **size** of each change, never the order. So if a question swaps the order, the answer stays the same.",
          "Aumento e depois desconto, ou desconto e depois aumento: 1,1 × 0,9 é o mesmo que 0,9 × 1,1. Nos dois casos você termina em 99%.\n\nO que muda o resultado é o **tamanho** de cada variação, nunca a ordem. Então, se a questão trocar a ordem, a resposta continua a mesma.",
        ),
        title: t("The order doesn't matter", "A ordem não importa"),
      },
      kind: "explanation",
      skill: "successive-percent",
    },
    {
      content: {
        keyPoints: [
          t(
            "The 20% raise is calculated on the lower salary, R$ 1,600",
            "O aumento de 20% é calculado sobre o salário menor, R$ 1.600",
          ),
          t(
            "0.8 × 1.2 = 0.96, so the salary is 96% of the original",
            "0,8 × 1,2 = 0,96, então o salário é 96% do original",
          ),
          t(
            "He now earns R$ 1,920, R$ 80 less than before",
            "Ele recebe agora R$ 1.920, R$ 80 a menos que antes",
          ),
        ],
        question: t(
          "An R$ 2,000 salary was cut by 20% and later raised by 20%. The worker says it's “back to normal”. In up to three sentences, explain why he's wrong and how much he earns now.",
          "Um salário de R$ 2.000 teve um corte de 20% e depois um aumento de 20%. O trabalhador diz que “voltou ao normal”. Em até três frases, explique por que ele está errado e quanto recebe agora.",
        ),
        sampleAnswer: t(
          "After the cut he earned R$ 1,600, and the 20% raise was calculated on that, adding only R$ 320. In one step: 0.8 × 1.2 = 0.96, so he gets 96% of the old salary. He now earns R$ 1,920, R$ 80 less than before.",
          "Depois do corte ele passou a ganhar R$ 1.600, e o aumento de 20% foi calculado sobre esse valor, somando só R$ 320. Numa conta só: 0,8 × 1,2 = 0,96, então ele recebe 96% do salário antigo. Agora ganha R$ 1.920, R$ 80 a menos que antes.",
        ),
      },
      kind: "typedAnswer",
      skill: "successive-percent",
    },
    {
      content: {
        ideas: [
          {
            text: t(
              "A rise of p% multiplies by (1 + p/100); a drop multiplies by (1 − p/100).",
              "Um aumento de p% multiplica por (1 + p/100); uma queda, por (1 − p/100).",
            ),
          },
          {
            text: t(
              "Changes in a row multiply; they never just add up.",
              "Variações seguidas se multiplicam; nunca se somam simplesmente.",
            ),
          },
          {
            text: t(
              "+p% then −p% always ends below the start: 1.1 × 0.9 = 0.99.",
              "+p% e depois −p% sempre termina abaixo do início: 1,1 × 0,9 = 0,99.",
            ),
          },
          {
            text: t(
              "The order of the changes doesn't affect the result.",
              "A ordem das variações não muda o resultado.",
            ),
          },
        ],
      },
      kind: "summary",
    },
  ],
  supportMode: "questionFirst",
  title: t("A raise, then a discount", "Aumento seguido de desconto"),
};
