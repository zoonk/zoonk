import { t } from "../../../_utils/localize";
import { guess, option } from "../../content";
import { type SeedLesson } from "../../types";

/**
 * Chapter "How trading works", lesson 1. The price on the screen is demystified as the last trade
 * between two people, the order book shows how trades happen, and a chart of results day shows
 * that expectations, not the company's buildings, move the price.
 */
export const wherePriceComesFromLesson: SeedLesson = {
  canDo: t(
    "You'll read an order book and explain why a price moves when nothing at the company changed.",
    "Você vai ler um livro de ofertas e explicar por que o preço muda mesmo quando nada mudou na empresa.",
  ),
  description: t(
    "Nobody sets a stock's price. It's the last deal between a buyer and a seller.",
    "Ninguém define o preço de uma ação. Ele é o último negócio entre quem compra e quem vende.",
  ),
  key: "where-price-comes-from",
  minutes: 6,
  skills: ["order-book", "price-last-trade"],
  steps: [
    {
      content: {
        options: [
          guess("company", t("The company", "A empresa")),
          guess("exchange", t("The stock exchange", "A bolsa de valores")),
          guess(
            "trade",
            t(
              "The last buyer and seller who agreed on a deal",
              "O último comprador e vendedor que fecharam negócio",
            ),
            true,
          ),
          guess("government", t("The government", "O governo")),
        ],
        question: t("Who sets the price of a share?", "Quem define o preço de uma ação?"),
        reveal: t(
          "Nobody sets it. The price on your screen is simply the price at which the most recent buyer and seller agreed.",
          "Ninguém define. O preço na sua tela é só o valor em que o último comprador e o último vendedor concordaram.",
        ),
        variant: "guess",
      },
      kind: "hook",
    },
    {
      content: {
        text: t(
          "At every moment, buyers post the most they'll pay, called **bids**, and sellers post the least they'll accept, called **asks**. Together they form the **order book**.\n\nWhile the best bid is below the best ask, nothing happens. A trade happens only when someone accepts the other side's price.",
          "A todo momento, compradores anunciam o máximo que pagam, as **ofertas de compra**, e vendedores anunciam o mínimo que aceitam, as **ofertas de venda**. Juntas, elas formam o **livro de ofertas**.\n\nEnquanto a melhor compra estiver abaixo da melhor venda, nada acontece. Só há negócio quando alguém aceita o preço do outro lado.",
        ),
        title: t("Two lines of people", "Duas filas de pessoas"),
      },
      kind: "explanation",
      skill: "order-book",
    },
    {
      content: {
        options: [
          option(
            "ask",
            t("$20.12", "R$ 20,12"),
            t(
              "To trade now, you accept the best ask: the lowest price a seller will take.",
              "Para negociar agora, você aceita a melhor venda: o menor preço que um vendedor aceita.",
            ),
            true,
          ),
          option(
            "bid",
            t("$20.10", "R$ 20,10"),
            t(
              "That's what buyers are offering. No seller has agreed to it yet.",
              "Esse é o valor que os compradores oferecem. Nenhum vendedor aceitou ainda.",
            ),
          ),
          option(
            "middle",
            t("$20.11", "R$ 20,11"),
            t(
              "Trades happen at a price someone posted. Nobody meets you halfway unless they post that price.",
              "O negócio sai num preço que alguém anunciou. Ninguém te encontra no meio do caminho sem anunciar esse preço.",
            ),
          ),
        ],
        question: t(
          "The best bid is $20.10 and the best ask is $20.12. You want to buy right now. What do you pay per share?",
          "A melhor oferta de compra é R$ 20,10 e a melhor de venda é R$ 20,12. Você quer comprar agora. Quanto paga por ação?",
        ),
      },
      kind: "check",
      skill: "order-book",
    },
    {
      content: {
        problem: t(
          "The order book has 200 shares for sale at **$20.12** and 500 at **$20.15**. You buy 300 shares at the market price. How much do you pay?",
          "O livro tem 200 ações à venda a **R$ 20,12** e 500 a **R$ 20,15**. Você compra 300 ações a mercado. Quanto paga?",
        ),
        result: t(
          "$6,039 in total, an average of $20.13 per share. And your own order moved the last price up to $20.15.",
          "R$ 6.039 no total, uma média de R$ 20,13 por ação. E a sua própria ordem levou o último preço para R$ 20,15.",
        ),
        steps: [
          {
            math: t(String.raw`200 \times 20.12 = 4{,}024`, String.raw`200 \times 20{,}12 = 4.024`),
            text: t(
              "The first 200 come from the cheapest seller:",
              "As primeiras 200 vêm do vendedor mais barato:",
            ),
          },
          {
            math: t(String.raw`100 \times 20.15 = 2{,}015`, String.raw`100 \times 20{,}15 = 2.015`),
            text: t("The other 100 come from the next one:", "As outras 100 vêm do próximo:"),
          },
          {
            math: t(String.raw`4{,}024 + 2{,}015 = 6{,}039`, String.raw`4.024 + 2.015 = 6.039`),
            text: t("Add them up:", "Some tudo:"),
          },
          {
            math: t(String.raw`6{,}039 \div 300 = 20.13`, String.raw`6.039 \div 300 = 20{,}13`),
            text: t("The average price per share:", "O preço médio por ação:"),
          },
        ],
        title: t(
          "Buying more than the first seller has",
          "Comprando mais do que o primeiro vendedor tem",
        ),
      },
      kind: "workedExample",
      skill: "order-book",
    },
    {
      content: {
        text: t(
          "The price changes whenever the balance changes. If more people want to buy than sell at today's price, buyers raise their bids and trades happen higher. If sellers rush out, they accept lower bids and the price falls.\n\nNothing inside the company has to change. What changed is what people **expect** from it.",
          "O preço muda sempre que o equilíbrio muda. Se mais gente quer comprar do que vender ao preço de hoje, os compradores sobem as ofertas e os negócios saem mais caros. Se os vendedores correm para sair, aceitam ofertas menores e o preço cai.\n\nNada dentro da empresa precisa mudar. O que mudou foi o que as pessoas **esperam** dela.",
        ),
        title: t("Why the price moves", "Por que o preço se mexe"),
      },
      kind: "explanation",
      skill: "price-last-trade",
    },
    {
      content: {
        check: {
          answer: 11.88,
          explanation: t(
            "From $20.20 to $22.60 is a rise of $2.40, or 2.40 ÷ 20.20 ≈ 11.9%, in one hour. The stores didn't change in that hour; the expectations did.",
            "De R$ 20,20 para R$ 22,60 é uma alta de R$ 2,40, ou 2,40 ÷ 20,20 ≈ 11,9%, em uma hora. As lojas não mudaram nessa hora; as expectativas, sim.",
          ),
          kind: "numeric",
          output: "news",
          question: t(
            "By what percent did the price move in the hour after the results?",
            "Em quantos por cento o preço variou na hora seguinte aos resultados?",
          ),
          tolerance: { kind: "absolute", value: 0.1 },
          unit: "%",
        },
        data: { isExample: true },
        fields: {
          points: [
            { x: 10, y: 20.1 },
            { x: 11, y: 20.05 },
            { x: 12, y: 20.15 },
            { x: 13, y: 20.12 },
            { x: 14, y: 20.2 },
            { x: 15, y: 22.6 },
            { x: 16, y: 22.4 },
            { x: 17, y: 22.55 },
          ],
          spans: [
            {
              from: 10,
              id: "before",
              label: t("Before the results", "Antes dos resultados"),
              to: 14,
            },
            {
              from: 14,
              id: "news",
              label: t("Hour after the results", "Hora após os resultados"),
              to: 15,
            },
          ],
          statistic: "percentChange",
          xLabel: t("Hour of the day", "Hora do dia"),
          yLabel: t("Share price", "Preço da ação"),
          yUnit: t("$", "R$"),
        },
        prompt: t(
          "The bakery chain published better results than expected at 2 pm. Measure how the price moved before and after.",
          "A rede de padarias divulgou resultados melhores que o esperado às 14h. Meça como o preço se mexeu antes e depois.",
        ),
        template: "chartReader",
      },
      kind: "activity",
      skill: "price-last-trade",
    },
    {
      content: {
        options: [
          option(
            "expected",
            t(
              "Investors expected even better results",
              "Os investidores esperavam resultados ainda melhores",
            ),
            t(
              "Prices already include what people expect. A record that's below expectations is a disappointment.",
              "Os preços já embutem o que as pessoas esperam. Um recorde abaixo do esperado é uma decepção.",
            ),
            true,
          ),
          option(
            "exchange",
            t(
              "The exchange lowers the price of very profitable companies",
              "A bolsa baixa o preço de empresas muito lucrativas",
            ),
            t(
              "The exchange doesn't set prices. Buyers and sellers do.",
              "A bolsa não define preços. Quem define são compradores e vendedores.",
            ),
          ),
          option(
            "always",
            t("Record profits always make prices fall", "Lucro recorde sempre derruba o preço"),
            t(
              "Not always. It depends on what was expected before the news.",
              "Nem sempre. Depende do que se esperava antes da notícia.",
            ),
          ),
        ],
        question: t(
          "A company reports record profits, and its share price falls. How is that possible?",
          "Uma empresa anuncia lucro recorde, e o preço da ação cai. Como isso é possível?",
        ),
      },
      kind: "check",
      screen: "application",
      skill: "price-last-trade",
    },
    {
      content: {
        keyPoints: [
          t(
            "The price is the last trade between a buyer and a seller",
            "O preço é o último negócio entre um comprador e um vendedor",
          ),
          t(
            "It moves when buyers and sellers change what they'll pay or accept",
            "Ele muda quando compradores e vendedores mudam o que pagam ou aceitam",
          ),
          t(
            "Expectations about the future can change even when the company doesn't",
            "As expectativas sobre o futuro podem mudar mesmo quando a empresa não muda",
          ),
        ],
        question: t(
          "In your own words: why can a stock's price change when nothing at the company has changed?",
          "Com as suas palavras: por que o preço de uma ação pode mudar quando nada mudou na empresa?",
        ),
        sampleAnswer: t(
          "The price is just the last deal between a buyer and a seller. When people start expecting more or less from the company, buyers and sellers change the prices they'll accept, and new deals happen at new prices, even if the company itself is exactly the same.",
          "O preço é só o último negócio entre um comprador e um vendedor. Quando as pessoas passam a esperar mais ou menos da empresa, compradores e vendedores mudam os preços que aceitam, e os novos negócios saem em novos preços, mesmo que a empresa continue igualzinha.",
        ),
      },
      kind: "typedAnswer",
      skill: "price-last-trade",
    },
    {
      content: {
        ideas: [
          {
            text: t(
              "Bids are what buyers offer; asks are what sellers accept.",
              "Ofertas de compra são o que compradores pagam; de venda, o que vendedores aceitam.",
            ),
          },
          {
            text: t(
              "A trade happens when one side accepts the other's price.",
              "O negócio sai quando um lado aceita o preço do outro.",
            ),
          },
          {
            text: t(
              "The price on the screen is just the last trade.",
              "O preço na tela é só o último negócio.",
            ),
          },
          {
            text: t(
              "Prices move with expectations, so good news can still sink a stock.",
              "Os preços se movem com as expectativas, então até notícia boa pode derrubar uma ação.",
            ),
          },
        ],
      },
      kind: "summary",
    },
  ],
  supportMode: "questionFirst",
  title: t("Where a price comes from", "De onde vem o preço de uma ação"),
};
