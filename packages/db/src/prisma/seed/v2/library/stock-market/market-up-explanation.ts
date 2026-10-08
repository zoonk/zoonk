import { t } from "../../_utils/localize";
import { option } from "../content";
import { type SeedLesson } from "../types";

/**
 * A quick explanation: five short screens and one question, answering a headline-sized question
 * right away. Its "Want to go further?" leads into "How the stock market works".
 */
export const marketUpExplanation: SeedLesson = {
  description: t(
    "What a headline means when it says the market went up, in five short screens.",
    "O que a manchete quer dizer quando fala que a Bolsa subiu, em cinco telas curtas.",
  ),
  key: "market-up-two-percent",
  minutes: 4,
  skills: ["read-market-headline"],
  steps: [
    {
      content: {
        text: t(
          "There are thousands of stocks, each with its own price. “The market” in a headline is an **index**: one number that tracks a basket of them.\n\nIn the US, it's usually the **S&P 500**, which follows 500 of the largest listed companies.",
          "Existem centenas de ações, cada uma com seu preço. Quando a manchete fala em “Bolsa”, está falando de um **índice**: um único número que acompanha uma cesta delas.\n\nNo Brasil, o principal é o **Ibovespa**, que reúne as ações mais negociadas da B3.",
        ),
        title: t("The market isn't one price", "A Bolsa não é um preço só"),
      },
      kind: "explanation",
    },
    {
      content: {
        text: t(
          "An index isn't a simple average. Each company counts according to its size, so a 1% move in a giant moves the index far more than a 1% move in a small company.",
          "Um índice não é uma média simples. Cada empresa pesa conforme o seu tamanho e o quanto é negociada, então 1% de alta numa gigante mexe muito mais no índice do que 1% numa empresa pequena.",
        ),
        title: t("Bigger companies weigh more", "Empresas maiores pesam mais"),
      },
      kind: "explanation",
    },
    {
      content: {
        text: t(
          "“Up 2%” compares the index now with where it closed the day before. If it closed at 6,000 points yesterday and stands at 6,120 now, it's up 2%.\n\nPoints are just the index's unit, like degrees on a thermometer.",
          "“Subiu 2%” compara o índice agora com o fechamento do dia anterior. Se ontem ele fechou em 130.000 pontos e agora está em 132.600, subiu 2%.\n\nPontos são só a unidade do índice, como graus num termômetro.",
        ),
        title: t("Up 2% since when?", "Subiu 2% desde quando?"),
      },
      kind: "explanation",
    },
    {
      content: {
        text: t(
          "Because big companies weigh more, a few giants rising can pull the index up even on a day when most stocks fall.\n\nThe headline tells you about the basket, not about each stock in it.",
          "Como as grandes pesam mais, algumas gigantes subindo podem puxar o índice para cima até num dia em que a maioria das ações cai.\n\nA manchete fala da cesta, não de cada ação dentro dela.",
        ),
        title: t("Most stocks can fall on an up day", "A maioria pode cair num dia de alta"),
      },
      kind: "explanation",
    },
    {
      content: {
        exampleLineSlot: {
          idea: t(
            "Money the learner might invest for the long run",
            "Um dinheiro que a pessoa talvez invista a longo prazo",
          ),
        },
        text: t(
          "You can buy the whole basket at once through an **index fund** or an ETF. Then “the market is up 2%” is almost exactly what happened to your money that day.",
          "Dá para comprar a cesta inteira de uma vez com um **fundo de índice** ou um ETF. Aí “a Bolsa subiu 2%” é quase exatamente o que aconteceu com o seu dinheiro naquele dia.",
        ),
        title: t("Why it matters to you", "Por que isso importa para você"),
      },
      kind: "explanation",
    },
    {
      content: {
        options: [
          option(
            "basket",
            t(
              "The basket of stocks in the index is worth 2% more than at yesterday's close",
              "A cesta de ações do índice vale 2% mais que no fechamento de ontem",
            ),
            t(
              "Right. It's the basket as a whole, weighted by size, compared with yesterday's close.",
              "Isso. É a cesta como um todo, pesada pelo tamanho, comparada com o fechamento de ontem.",
            ),
            true,
          ),
          option(
            "every",
            t("Every stock went up 2%", "Todas as ações subiram 2%"),
            t(
              "Some rose more, some fell. 2% is the basket's move.",
              "Algumas subiram mais, outras caíram. 2% é o movimento da cesta.",
            ),
          ),
          option(
            "yours",
            t("Your stocks went up 2%", "As suas ações subiram 2%"),
            t(
              "Only if you own the whole basket, as in an index fund.",
              "Só se você tiver a cesta inteira, como num fundo de índice.",
            ),
          ),
        ],
        question: t(
          "A headline says the market is up 2% today. What do you know for sure?",
          "A manchete diz que a Bolsa subiu 2% hoje. O que você sabe com certeza?",
        ),
      },
      kind: "check",
    },
    {
      content: {
        ideas: [
          {
            text: t(
              "“The market” is an index: one number for a basket of stocks.",
              "“A Bolsa” é um índice: um número para uma cesta de ações.",
            ),
          },
          {
            text: t(
              "“Up 2%” compares it with yesterday's close, with big companies weighing more.",
              "“Subiu 2%” compara com o fechamento de ontem, e as grandes empresas pesam mais.",
            ),
          },
          {
            text: t(
              "An index fund lets you own the whole basket, so its move is yours.",
              "Um fundo de índice te deixa ter a cesta inteira, então o movimento dela é o seu.",
            ),
          },
        ],
      },
      kind: "summary",
    },
  ],
  title: t("What does it mean when “the market is up 2%”?", "O que quer dizer “a Bolsa subiu 2%”?"),
};
