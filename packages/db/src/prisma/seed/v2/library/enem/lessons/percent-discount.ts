import { t } from "../../../_utils/localize";
import { guess, option } from "../../content";
import { type SeedLesson } from "../../types";

/**
 * Percentages chapter, lesson 2. Opens on the most common slip (answering with the discount instead
 * of the price paid), builds a mental-math shortcut, then moves from a worked "buy 4, pay for 3" to
 * the ENEM classic "buy 3, pay for 2" with less support.
 */
export const percentDiscountLesson: SeedLesson = {
  canDo: t(
    "You'll work out “buy 3, pay for 2” in your head.",
    "Você vai calcular “leve 3, pague 2” de cabeça.",
  ),
  description: t(
    "What you really pay in a sale, and the real discount behind “buy 3, pay for 2”.",
    "Quanto você paga de verdade numa promoção, e o desconto real por trás do “leve 3, pague 2”.",
  ),
  key: "percent-discount",
  minutes: 5,
  skills: ["percent-discount", "buy-x-pay-y"],
  steps: [
    {
      content: {
        options: [
          guess("discount", t("R$ 20", "R$ 20")),
          guess("fifty-five", t("R$ 55", "R$ 55")),
          guess("sixty", t("R$ 60", "R$ 60"), true),
          guess("sixty-four", t("R$ 64", "R$ 64")),
        ],
        question: t(
          "An R$ 80 T-shirt is 25% off. How much do you pay?",
          "Uma camiseta de R$ 80 está com 25% de desconto. Quanto você paga?",
        ),
        reveal: t(
          "R$ 60. The R$ 20 is what you save; you pay the rest. Mixing up the two is one of the most common slips in percentage questions.",
          "R$ 60. Os R$ 20 são o que você economiza; você paga o resto. Confundir os dois é um dos deslizes mais comuns em questões de porcentagem.",
        ),
        variant: "guess",
      },
      kind: "hook",
    },
    {
      content: {
        exampleLineSlot: {
          idea: t(
            "A price with a discount the learner might see while shopping",
            "Um preço com desconto que a pessoa veria fazendo compras",
          ),
        },
        text: t(
          "25% off doesn't mean you pay 25%. It means you **don't** pay 25%. You pay the rest: 100% − 25% = **75%**.\n\nSo go straight to what you pay: 75% of 80 = 0.75 × 80 = **R$ 60**.",
          "25% de desconto não quer dizer que você paga 25%. Quer dizer que você **não** paga 25%. Você paga o resto: 100% − 25% = **75%**.\n\nEntão vá direto ao que você paga: 75% de 80 = 0,75 × 80 = **R$ 60**.",
        ),
        title: t("A discount is part of the price", "O desconto é uma parte do preço"),
      },
      kind: "explanation",
      skill: "percent-discount",
    },
    {
      content: {
        text: t(
          "No calculator? Start from 10%, which is just moving the decimal point one place: 10% of 80 is 8.\n\n- 20% is two 10%s: 16\n- 5% is half of 10%: 4\n- 25% = 20% + 5% = 16 + 4 = 20\n\nThen subtract: 80 − 20 = R$ 60.",
          "Sem calculadora? Comece pelos 10%, que é só andar com a vírgula uma casa: 10% de 80 é 8.\n\n- 20% são dois 10%: 16\n- 5% é metade de 10%: 4\n- 25% = 20% + 5% = 16 + 4 = 20\n\nDepois é só subtrair: 80 − 20 = R$ 60.",
        ),
        title: t("The 10% shortcut", "O atalho dos 10%"),
      },
      kind: "explanation",
      skill: "percent-discount",
    },
    {
      content: {
        options: [
          option(
            "discount",
            t("R$ 30", "R$ 30"),
            t(
              "That's the discount, 20% of 150. You pay what's left.",
              "Esse é o desconto, 20% de 150. Você paga o que sobra.",
            ),
          ),
          option(
            "paid",
            t("R$ 120", "R$ 120"),
            t("You pay 80% of 150: 0.8 × 150 = 120.", "Você paga 80% de 150: 0,8 × 150 = 120."),
            true,
          ),
          option(
            "reais",
            t("R$ 130", "R$ 130"),
            t(
              "That takes off 20 reais, not 20 percent. 20% of 150 is 30.",
              "Isso tira 20 reais, não 20 por cento. 20% de 150 é 30.",
            ),
          ),
          option(
            "quarter",
            t("R$ 125", "R$ 125"),
            t(
              "Close, but 20% of 150 is 30, not 25: two 10%s of 15 each.",
              "Quase, mas 20% de 150 é 30, não 25: dois 10% de 15 cada.",
            ),
          ),
        ],
        question: t(
          "Sneakers cost R$ 150 with 20% off. How much do you pay?",
          "Um tênis de R$ 150 está com 20% de desconto. Quanto você paga?",
        ),
      },
      kind: "check",
      skill: "percent-discount",
    },
    {
      content: {
        check: {
          answer: 52,
          explanation: t(
            "With 35% off you pay 65%: 0.65 × 80 = R$ 52. Every 5% more off takes R$ 4 off the price.",
            "Com 35% de desconto você paga 65%: 0,65 × 80 = R$ 52. Cada 5% a mais de desconto tira R$ 4 do preço.",
          ),
          inputs: [{ name: "off", value: 35 }],
          kind: "numeric",
          question: t(
            "With 35% off, how much do you pay for the T-shirt?",
            "Com 35% de desconto, quanto você paga pela camiseta?",
          ),
          tolerance: { kind: "absolute", value: 0.01 },
          unit: "R$",
        },
        data: { isExample: true },
        fields: {
          compareAt: 25,
          formula: "80 * (1 - off / 100)",
          output: { label: t("You pay", "Você paga"), unit: "R$" },
          variable: {
            initial: 25,
            label: t("Discount", "Desconto"),
            max: 90,
            min: 0,
            name: "off",
            step: 5,
            unit: "%",
          },
        },
        prompt: t(
          "Slide the discount on the R$ 80 T-shirt and watch what you pay. The line drops R$ 8 for every 10%.",
          "Deslize o desconto da camiseta de R$ 80 e veja quanto você paga. A linha cai R$ 8 a cada 10%.",
        ),
        template: "sliderGraph",
      },
      kind: "activity",
      skill: "percent-discount",
    },
    {
      content: {
        problem: t(
          "A store advertises **“Buy 4, pay for 3”**. Each piece costs R$ 30. What's the real discount on each piece?",
          "Uma loja anuncia **“Leve 4, pague 3”**. Cada peça custa R$ 30. Qual é o desconto real em cada peça?",
        ),
        result: t(
          "25% off each piece. The price didn't matter: 1 free out of 4 is always 1/4.",
          "25% de desconto em cada peça. O preço nem importou: 1 grátis em 4 é sempre 1/4.",
        ),
        steps: [
          {
            math: String.raw`4 \times 30 = 120`,
            text: t("Without the deal, 4 pieces would cost:", "Sem a promoção, 4 peças custariam:"),
          },
          { math: String.raw`3 \times 30 = 90`, text: t("You only pay for 3:", "Você só paga 3:") },
          {
            math: String.raw`120 - 90 = 30`,
            text: t("You save the difference:", "Você economiza a diferença:"),
          },
          {
            math: String.raw`\dfrac{30}{120} = \dfrac{1}{4} = 25\%`,
            text: t(
              "The discount is what you save out of what it would cost:",
              "O desconto é o que você economiza sobre o que custaria:",
            ),
          },
        ],
        title: t("Buy 4, pay for 3", "Leve 4, pague 3"),
      },
      kind: "workedExample",
      skill: "buy-x-pay-y",
    },
    {
      content: {
        context: t(
          "A store advertises: **“Buy 3, pay for 2.”**",
          "Uma loja anuncia: **“Leve 3, pague 2.”**",
        ),
        options: [
          option(
            "a",
            t("20%", "20%"),
            t("That would be 1 free out of 5.", "Isso seria 1 grátis em 5."),
          ),
          option(
            "b",
            t("25%", "25%"),
            t(
              "That's 1 free out of 4: you divided the free piece by 4 instead of 3.",
              "Isso é 1 grátis em 4: você dividiu a peça grátis por 4, e não por 3.",
            ),
          ),
          option(
            "c",
            t("33.3%", "33,3%"),
            t(
              "You take 3 and get 1 free: 1 ÷ 3 ≈ 33.3% off each piece.",
              "Você leva 3 e ganha 1: 1 ÷ 3 ≈ 33,3% de desconto em cada peça.",
            ),
            true,
          ),
          option(
            "d",
            t("50%", "50%"),
            t(
              "That compares the free piece with the 2 you pay for. The discount is out of the full price of all 3.",
              "Isso compara a peça grátis com as 2 que você paga. O desconto é sobre o preço cheio das 3.",
            ),
          ),
          option(
            "e",
            t("66.7%", "66,7%"),
            t(
              "That's the share you pay, 2 out of 3, not the discount.",
              "Essa é a parte que você paga, 2 de 3, não o desconto.",
            ),
          ),
        ],
        question: t(
          "What's the real discount on the price of each item?",
          "Qual é o desconto real no preço de cada peça?",
        ),
      },
      kind: "check",
      screen: "application",
      skill: "buy-x-pay-y",
    },
    {
      content: {
        keyPoints: [
          t("You get 1 piece free out of 3", "Você ganha 1 peça grátis a cada 3"),
          t(
            "The discount is measured against the full price of the 3 pieces",
            "O desconto é medido sobre o preço cheio das 3 peças",
          ),
          t("1/3 is about 33.3%, not 1/2", "1/3 é cerca de 33,3%, não 1/2"),
        ],
        question: t(
          "A friend says “buy 3, pay for 2” is a 50% discount. In two or three sentences, explain why it isn't.",
          "Um amigo diz que “leve 3, pague 2” é 50% de desconto. Em duas ou três frases, explique por que não é.",
        ),
        sampleAnswer: t(
          "You take 3 pieces and pay for 2, so you get 1 free out of 3. The discount is measured against the full price of all 3, which makes it 1/3, about 33.3%. It would only be 50% if you got 1 free for every one you paid for.",
          "Você leva 3 peças e paga 2, então ganha 1 grátis a cada 3. O desconto é medido sobre o preço cheio das 3, o que dá 1/3, cerca de 33,3%. Só seria 50% se você ganhasse 1 peça grátis para cada uma que pagasse.",
        ),
      },
      kind: "typedAnswer",
      skill: "buy-x-pay-y",
    },
    {
      content: {
        ideas: [
          {
            text: t(
              "With p% off, you pay (100 − p)% of the price.",
              "Com p% de desconto, você paga (100 − p)% do preço.",
            ),
          },
          {
            text: t(
              "10% is just moving the decimal point; build other percents from it.",
              "10% é só andar com a vírgula; monte as outras porcentagens a partir dele.",
            ),
          },
          {
            text: t(
              "“Buy X, pay for Y”: the discount is the free items out of X.",
              "“Leve X, pague Y”: o desconto é o número de itens grátis sobre X.",
            ),
          },
          {
            text: t(
              "Buy 3, pay for 2 is 1/3 ≈ 33.3% off, never 50%.",
              "Leve 3, pague 2 é 1/3 ≈ 33,3% de desconto, nunca 50%.",
            ),
          },
        ],
      },
      kind: "summary",
    },
  ],
  supportMode: "questionFirst",
  title: t("Percentages and discounts", "Porcentagem e descontos"),
};
