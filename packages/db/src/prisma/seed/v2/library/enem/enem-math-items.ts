import { t } from "../../_utils/localize";
import { bankOption } from "../content";
import { type SeedItem } from "../types";

/** Math practice: numeric items keep the solution as data, ENEM-format ones have five options. */
export const enemMathItems: SeedItem[] = [
  {
    content: {
      context: null,
      math: {
        answer: 102,
        commonMistakes: [
          {
            expression: "price * rate / 100",
            misconception: t(
              "Answered with the discount instead of the price paid",
              "Respondeu com o desconto em vez do preço pago",
            ),
            reason: t(
              "That's what you save. You pay what's left after it.",
              "Isso é o que você economiza. Você paga o que sobra depois dele.",
            ),
          },
          {
            expression: "price - rate",
            misconception: t(
              "Subtracted the percent as if it were reais",
              "Subtraiu a porcentagem como se fosse em reais",
            ),
            reason: t(
              "15% of R$ 120 isn't R$ 15: it's 0.15 × 120.",
              "15% de R$ 120 não são R$ 15: são 0,15 × 120.",
            ),
          },
        ],
        solution: "price * (1 - rate / 100)",
        steps: [
          {
            expression: null,
            text: t(
              "You pay what's left: 100% − {rate}%.",
              "Você paga o que sobra: 100% − {rate}%.",
            ),
          },
          {
            expression: "price * (1 - rate / 100)",
            text: t(
              "{price} × (1 − {rate}/100) = {result}",
              "{price} × (1 − {rate}/100) = {result}",
            ),
          },
        ],
        tolerance: { kind: "absolute", value: 0.01 },
        unit: "R$",
        variables: [
          { max: 400, min: 40, name: "price", step: 10, unit: "R$", value: 120 },
          { max: 60, min: 5, name: "rate", step: 5, unit: "%", value: 15 },
        ],
      },
      question: t(
        "An R$ {price} shirt is {rate}% off. How much do you pay, in reais?",
        "Uma camisa de R$ {price} está com {rate}% de desconto. Quanto você paga, em reais?",
      ),
    },
    difficulty: -1,
    format: "numeric",
    key: "discount-shirt",
    skill: "percent-discount",
  },
  {
    content: {
      context: t(
        "An appliance store sells a refrigerator for R$ 2,400 and gives 15% off for cash payment.",
        "Uma loja de eletrodomésticos vende uma geladeira por R$ 2.400 e dá 15% de desconto no pagamento à vista.",
      ),
      options: [
        bankOption(
          t("R$ 360", "R$ 360"),
          t(
            "R$ 360 is the discount. The price paid is what's left.",
            "R$ 360 é o desconto. O preço pago é o que sobra.",
          ),
          t(
            "Answered with the discount instead of the price paid",
            "Respondeu com o desconto em vez do preço pago",
          ),
        ),
        bankOption(
          t("R$ 2,040", "R$ 2.040"),
          t(
            "You pay 85% of 2,400: 0.85 × 2,400 = 2,040.",
            "Você paga 85% de 2.400: 0,85 × 2.400 = 2.040.",
          ),
        ),
        bankOption(
          t("R$ 2,160", "R$ 2.160"),
          t(
            "That takes off only 10%. The other 5%, R$ 120, is missing.",
            "Isso tira só 10%. Faltam os outros 5%, R$ 120.",
          ),
          t(
            "Built 15% from 10% and forgot the 5%",
            "Montou os 15% a partir dos 10% e esqueceu os 5%",
          ),
        ),
        bankOption(
          t("R$ 2,385", "R$ 2.385"),
          t("That takes off 15 reais, not 15 percent.", "Isso tira 15 reais, não 15 por cento."),
          t(
            "Subtracted the percent as if it were reais",
            "Subtraiu a porcentagem como se fosse em reais",
          ),
        ),
        bankOption(
          t("R$ 2,760", "R$ 2.760"),
          t(
            "That adds 15%. A discount lowers the price.",
            "Isso soma 15%. Desconto diminui o preço.",
          ),
          t(
            "Added the percent instead of subtracting it",
            "Somou a porcentagem em vez de subtrair",
          ),
        ),
      ],
      question: t(
        "How much does the refrigerator cost with cash payment?",
        "Quanto custa a geladeira no pagamento à vista?",
      ),
    },
    difficulty: -1,
    exam: "enem",
    format: "multipleChoice",
    key: "discount-refrigerator",
    skill: "percent-discount",
  },
  {
    content: {
      context: t(
        "A supermarket advertises “buy 5, pay for 4” on R$ 18 packs of coffee.",
        "Um supermercado anuncia “leve 5, pague 4” em pacotes de café de R$ 18.",
      ),
      options: [
        bankOption(
          t("4%", "4%"),
          t(
            "The 4 is a number of packs, not a percent.",
            "O 4 é número de pacotes, não porcentagem.",
          ),
          t(
            "Read the number of items paid as a percent",
            "Leu o número de itens pagos como porcentagem",
          ),
        ),
        bankOption(
          t("18%", "18%"),
          t(
            "R$ 18 is the price of a pack. The discount doesn't depend on it.",
            "R$ 18 é o preço do pacote. O desconto não depende dele.",
          ),
          t("Used the price in reais as the percent", "Usou o preço em reais como porcentagem"),
        ),
        bankOption(
          t("20%", "20%"),
          t("1 free out of 5: 1 ÷ 5 = 20%.", "1 grátis em 5: 1 ÷ 5 = 20%."),
        ),
        bankOption(
          t("25%", "25%"),
          t(
            "That divides the free pack by the 4 you pay for. The discount is out of all 5.",
            "Isso divide o pacote grátis pelos 4 pagos. O desconto é sobre os 5.",
          ),
          t(
            "Divided the free item by the items paid instead of all items",
            "Dividiu o item grátis pelos pagos em vez do total",
          ),
        ),
        bankOption(
          t("80%", "80%"),
          t("80% is the share you pay, 4 of 5.", "80% é a parte que você paga, 4 de 5."),
          t(
            "Answered with the share paid instead of the discount",
            "Respondeu com a parte paga em vez do desconto",
          ),
        ),
      ],
      question: t(
        "What's the real discount on each pack?",
        "Qual é o desconto real em cada pacote?",
      ),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "buy-five-pay-four",
    skill: "buy-x-pay-y",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(t("0.92", "0,92"), t("100% − 8% = 92% = 0.92.", "100% − 8% = 92% = 0,92.")),
        bankOption(
          t("0.08", "0,08"),
          t(
            "0.08 is only the drop. Multiplying by it would leave 8% of the price.",
            "0,08 é só a queda. Multiplicar por ele deixaria 8% do preço.",
          ),
          t("Used the change itself as the multiplier", "Usou a própria variação como fator"),
        ),
        bankOption(
          t("1.08", "1,08"),
          t("1.08 is an 8% rise.", "1,08 é um aumento de 8%."),
          t("Mixed up a rise and a drop", "Confundiu aumento com queda"),
        ),
        bankOption(
          t("0.8", "0,8"),
          t(
            "0.8 is a 20% drop. 8% is 0.08, so the multiplier is 0.92.",
            "0,8 é uma queda de 20%. 8% é 0,08, então o fator é 0,92.",
          ),
          t("Read 8% as 0.8 instead of 0.08", "Leu 8% como 0,8 em vez de 0,08"),
        ),
      ],
      question: t(
        "What do you multiply a price by to lower it by 8%?",
        "Por quanto você multiplica um preço para reduzi-lo em 8%?",
      ),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "factor-eight-percent",
    skill: "percent-factor",
  },
  {
    content: {
      context: null,
      math: {
        answer: 198,
        commonMistakes: [
          {
            expression: "price * (1 + (up - down) / 100)",
            misconception: t(
              "Added the percents as if they cancel out",
              "Somou as porcentagens como se elas se anulassem",
            ),
            reason: t(
              "The second change applies to the new price, so the changes multiply.",
              "A segunda variação vale sobre o novo preço, então as variações se multiplicam.",
            ),
          },
          {
            expression: "price * (1 - down / 100)",
            misconception: t("Ignored the first change", "Ignorou a primeira variação"),
            reason: t(
              "The drop comes after the rise, on the raised price.",
              "A queda vem depois do aumento, sobre o preço aumentado.",
            ),
          },
        ],
        solution: "price * (1 + up / 100) * (1 - down / 100)",
        steps: [
          {
            expression: null,
            text: t(
              "Multipliers: 1 + {up}/100 and 1 − {down}/100.",
              "Fatores: 1 + {up}/100 e 1 − {down}/100.",
            ),
          },
          {
            expression: "price * (1 + up / 100) * (1 - down / 100)",
            text: t(
              "{price} × (1 + {up}/100) × (1 − {down}/100) = {result}",
              "{price} × (1 + {up}/100) × (1 − {down}/100) = {result}",
            ),
          },
        ],
        tolerance: { kind: "absolute", value: 0.01 },
        unit: "R$",
        variables: [
          { max: 1000, min: 100, name: "price", step: 50, unit: "R$", value: 200 },
          { max: 50, min: 5, name: "up", step: 5, unit: "%", value: 10 },
          { max: 50, min: 5, name: "down", step: 5, unit: "%", value: 10 },
        ],
      },
      question: t(
        "An R$ {price} product goes up {up}% and, the next month, down {down}%. What's the final price, in reais?",
        "Um produto de R$ {price} sobe {up}% e, no mês seguinte, cai {down}%. Qual é o preço final, em reais?",
      ),
    },
    difficulty: 0,
    format: "numeric",
    key: "up-then-down",
    skill: "successive-percent",
  },
  {
    content: {
      context: t(
        "An investor put R$ 1,000 into a fund. In the first month it gained 10%; in the second, it lost 10%.",
        "Um investidor aplicou R$ 1.000 num fundo. No primeiro mês, a aplicação rendeu 10%; no segundo, perdeu 10%.",
      ),
      options: [
        bankOption(
          t("R$ 1,000", "R$ 1.000"),
          t(
            "The 10% loss came off R$ 1,100, so it took R$ 110.",
            "A perda de 10% saiu de R$ 1.100, então tirou R$ 110.",
          ),
          t(
            "Thought equal gains and losses cancel out",
            "Achou que ganho e perda iguais se anulam",
          ),
        ),
        bankOption(
          t("R$ 990", "R$ 990"),
          t("1,000 × 1.1 × 0.9 = 990.", "1.000 × 1,1 × 0,9 = 990."),
        ),
        bankOption(
          t("R$ 900", "R$ 900"),
          t(
            "That applies only the loss, to the original amount.",
            "Isso aplica só a perda, sobre o valor inicial.",
          ),
          t("Applied only the second change", "Aplicou só a segunda variação"),
        ),
        bankOption(
          t("R$ 1,100", "R$ 1.100"),
          t(
            "That's the balance after the first month only.",
            "Esse é o saldo só depois do primeiro mês.",
          ),
          t("Applied only the first change", "Aplicou só a primeira variação"),
        ),
        bankOption(
          t("R$ 999", "R$ 999"),
          t(
            "1.1 × 0.9 = 0.99 is a 1% loss, not 0.1%.",
            "1,1 × 0,9 = 0,99 é uma perda de 1%, não de 0,1%.",
          ),
          t(
            "Read the net change as 0.1% instead of 1%",
            "Leu a variação líquida como 0,1% em vez de 1%",
          ),
        ),
      ],
      question: t(
        "After the two months, the investor has:",
        "Ao fim dos dois meses, o investidor tem:",
      ),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "fund-gain-loss",
    skill: "successive-percent",
  },
];
