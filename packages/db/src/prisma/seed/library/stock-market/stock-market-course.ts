import { t } from "../../_utils/localize";
import { outlineLesson, withPractice } from "../content";
import { type SeedCourse } from "../types";
import { ownAShareLesson } from "./lessons/own-a-share";
import { wherePriceComesFromLesson } from "./lessons/where-price-comes-from";
import { marketUpExplanation } from "./market-up-explanation";
import { stockMarketChallengeItems } from "./stock-market-challenge-items";
import { stockMarketItems } from "./stock-market-items";
import { stockMarketPlacementItems } from "./stock-market-placement-items";
import { stockMarketSkills } from "./stock-market-skills";

export const stockMarketCourse: SeedCourse = {
  category: "economics",
  chapters: [
    {
      description: t(
        "What you own when you buy a stock, and why companies sell them.",
        "O que você tem quando compra uma ação, e por que as empresas vendem ações.",
      ),
      key: "what-a-stock-is",
      lessons: [
        ownAShareLesson,
        withPractice(
          outlineLesson(
            "why-companies-sell",
            {
              description: t(
                "Raising money without a loan, in exchange for sharing the profit.",
                "Levantar dinheiro sem empréstimo, em troca de dividir o lucro.",
              ),
              title: t("Why companies sell shares", "Por que as empresas vendem ações"),
            },
            ["ipo"],
          ),
          {
            answer: t("The bakery", "A padaria"),
            distractor: t(
              "The investor who owned shares yesterday",
              "O investidor que já tinha ações ontem",
            ),
            example: t(
              "A bakery needs new ovens. It issues shares to investors and uses their money to buy the ovens. The investors now own part of the bakery.",
              "Uma padaria precisa de fornos novos. Ela emite ações para investidores e usa o dinheiro para comprar os fornos. Os investidores passam a ser donos de parte da padaria.",
            ),
            question: t(
              "Who receives the money when the bakery issues new shares?",
              "Quem recebe o dinheiro quando a padaria emite ações novas?",
            ),
            reason: t(
              "In a new issue, the company raises capital. In a resale, the buyer pays the selling shareholder.",
              "Na emissão, a empresa capta recursos. Na revenda, o comprador paga ao acionista que vende.",
            ),
          },
        ),
        withPractice(
          outlineLesson(
            "dividends",
            {
              description: t(
                "The part of the profit that lands in your account.",
                "A parte do lucro que cai na sua conta.",
              ),
              title: t("Dividends: a share of the profit", "Dividendos: uma parte do lucro"),
            },
            ["dividends"],
          ),
          {
            answer: t("10 reais", "10 reais"),
            distractor: t("2 reais", "2 reais"),
            example: t(
              "A company declares a dividend of 2 reais per share. Someone holding 3 eligible shares receives 6 reais.",
              "Uma empresa declara dividendos de 2 reais por ação. Quem tem 3 ações com direito ao pagamento recebe 6 reais.",
            ),
            question: t(
              "How much does a holder of 5 eligible shares receive?",
              "Quanto recebe quem tem 5 ações com direito ao pagamento?",
            ),
            reason: t(
              "Multiply the dividend per share by the number of eligible shares.",
              "Multiplique o dividendo por ação pelo número de ações com direito ao pagamento.",
            ),
          },
        ),
      ],
      level: "overview",
      objectives: [
        t("Explain what owning a share means", "Explicar o que é ser dono de uma ação"),
        t(
          "Tell what shareholders get and don't get",
          "Saber o que o acionista recebe e o que não recebe",
        ),
      ],
      title: t("What a stock is", "O que é uma ação"),
    },
    {
      description: t(
        "Where prices come from and how orders meet.",
        "De onde vêm os preços e como as ordens se encontram.",
      ),
      key: "how-trading-works",
      lessons: [
        wherePriceComesFromLesson,
        outlineLesson(
          "brokers-exchanges",
          {
            description: t(
              "The path your order takes after you tap buy.",
              "O caminho da sua ordem depois que você toca em comprar.",
            ),
            title: t("Brokers and exchanges", "Corretoras e bolsas"),
          },
          ["brokers"],
        ),
        outlineLesson(
          "indexes",
          {
            description: t(
              "One number for the whole market, and how it's built.",
              "Um número para o mercado inteiro, e como ele é montado.",
            ),
            title: t(
              "Indexes like the S&P 500 and the Ibovespa",
              "Índices como o Ibovespa e o S&P 500",
            ),
          },
          ["indexes"],
          5,
        ),
      ],
      level: "overview",
      objectives: [
        t("Read an order book", "Ler um livro de ofertas"),
        t(
          "Explain where prices and indexes come from",
          "Explicar de onde vêm os preços e os índices",
        ),
      ],
      title: t("How trading works", "Como funcionam as negociações"),
    },
    {
      description: t(
        "News, expectations, bubbles and crashes.",
        "Notícias, expectativas, bolhas e quedas.",
      ),
      key: "why-prices-move",
      lessons: [
        outlineLesson(
          "news-expectations",
          {
            description: t(
              "Why good news can sink a stock.",
              "Por que uma notícia boa pode derrubar uma ação.",
            ),
            title: t("News, results and expectations", "Notícias, resultados e expectativas"),
          },
          ["expectations"],
        ),
        outlineLesson(
          "bubbles-crashes",
          {
            description: t(
              "When prices run ahead of profits.",
              "Quando os preços correm na frente dos lucros.",
            ),
            title: t("Bubbles and crashes", "Bolhas e quedas"),
          },
          ["bubbles"],
          5,
        ),
      ],
      level: "overview",
      objectives: [
        t("Explain why prices rise and fall", "Explicar por que os preços sobem e caem"),
      ],
      title: t("Why prices move", "Por que os preços se mexem"),
    },
    {
      description: t(
        "Compound growth, diversification and matching risk to time.",
        "Juros sobre juros, diversificação e risco de acordo com o prazo.",
      ),
      key: "long-run",
      lessons: [
        outlineLesson(
          "compound-growth",
          {
            description: t(
              "Why the first years feel slow and the later ones don't.",
              "Por que os primeiros anos parecem lentos e os seguintes, não.",
            ),
            title: t("Compound growth", "Juros sobre juros"),
          },
          ["compound-growth"],
        ),
        outlineLesson(
          "diversification",
          {
            description: t(
              "Owning many companies so one can't sink you.",
              "Ter muitas empresas para que uma só não te afunde.",
            ),
            title: t(
              "Don't put all your eggs in one basket",
              "Não coloque todos os ovos na mesma cesta",
            ),
          },
          ["diversification"],
        ),
        outlineLesson(
          "risk-and-time",
          {
            description: t(
              "Which money belongs in stocks, and which doesn't.",
              "Que dinheiro faz sentido na bolsa, e qual não faz.",
            ),
            title: t("Risk and time", "Risco e prazo"),
          },
          ["risk-horizon"],
        ),
      ],
      level: "overview",
      objectives: [
        t(
          "Explain compound growth and diversification",
          "Explicar juros sobre juros e diversificação",
        ),
        t(
          "Match investments to when you need the money",
          "Escolher investimentos pelo prazo em que você precisa do dinheiro",
        ),
      ],
      title: t("Investing for the long run", "Investir no longo prazo"),
    },
  ],
  description: t(
    "What a stock is, where its price comes from and how people invest for the long run.",
    "O que é uma ação, de onde vem o preço dela e como as pessoas investem no longo prazo.",
  ),
  explanations: [marketUpExplanation],
  format: "core",
  items: [...stockMarketItems, ...stockMarketChallengeItems, ...stockMarketPlacementItems],
  key: "stock-market",
  languages: ["en", "pt"],
  skills: stockMarketSkills,
  slug: t("how-the-stock-market-works", "como-funciona-a-bolsa-de-valores-pt"),
  title: t("How the stock market works", "Como funciona a bolsa de valores"),
};
