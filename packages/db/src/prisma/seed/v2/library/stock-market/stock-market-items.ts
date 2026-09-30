import { t } from "../../_utils/localize";
import { bankOption } from "../content";
import { type SeedItem } from "../types";

/** Review questions for the written lessons and the quick explanation. */
export const stockMarketItems: SeedItem[] = [
  {
    content: {
      context: null,
      options: [
        bankOption(
          t("The shareholders", "Os acionistas"),
          t(
            "Owners are paid only if something is left after lenders, workers and taxes.",
            "Os donos só recebem se sobrar algo depois de credores, trabalhadores e impostos.",
          ),
        ),
        bankOption(
          t("The banks that lent money", "Os bancos que emprestaram dinheiro"),
          t(
            "Lenders come before shareholders: a loan must be repaid first.",
            "Credores vêm antes dos acionistas: o empréstimo precisa ser pago primeiro.",
          ),
          t("Thinks lenders are paid after owners", "Acha que credores recebem depois dos donos"),
        ),
        bankOption(
          t("The employees", "Os funcionários"),
          t(
            "Workers' wages are among the first debts paid.",
            "Os salários dos funcionários estão entre as primeiras dívidas pagas.",
          ),
          t("Thinks workers are paid last", "Acha que os funcionários recebem por último"),
        ),
      ],
      question: t(
        "A company goes bankrupt. Who is paid last?",
        "Uma empresa vai à falência. Quem recebe por último?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "paid-last",
    skill: "shareholder-rights",
  },
  {
    content: {
      context: null,
      math: {
        answer: 0.05,
        commonMistakes: [
          {
            expression: "owned / total",
            misconception: t(
              "Gave the fraction instead of the percent",
              "Deu a fração em vez da porcentagem",
            ),
            reason: t(
              "A share of the company becomes a percent when you multiply by 100.",
              "A fração da empresa vira porcentagem quando você multiplica por 100.",
            ),
          },
          {
            expression: "total / owned",
            misconception: t("Divided the other way around", "Dividiu ao contrário"),
            reason: t(
              "Your part is your shares divided by all the shares.",
              "A sua parte é as suas ações divididas pelo total de ações.",
            ),
          },
        ],
        solution: "owned / total * 100",
        steps: [
          {
            expression: "owned / total",
            text: t(
              "Your shares out of all shares: {result}",
              "Suas ações sobre o total: {result}",
            ),
          },
          {
            expression: "owned / total * 100",
            text: t("As a percent: {result}%", "Em porcentagem: {result}%"),
          },
        ],
        tolerance: { kind: "relative", value: 0.001 },
        unit: "%",
        variables: [
          { max: 20_000, min: 500, name: "owned", step: 500, unit: null, value: 5000 },
          {
            max: 50_000_000,
            min: 5_000_000,
            name: "total",
            step: 5_000_000,
            unit: null,
            value: 10_000_000,
          },
        ],
      },
      question: t(
        "A company has {total} shares and you own {owned}. What percent of the company do you own?",
        "Uma empresa tem {total} ações e você tem {owned}. Que porcentagem da empresa é sua?",
      ),
    },
    difficulty: 0,
    format: "numeric",
    key: "ownership-percent",
    skill: "share-ownership",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks shares come with a promised return",
        "Acha que ações vêm com retorno prometido",
      ),
      reason: t(
        "Nobody promises shareholders a return. Dividends and gains depend on how the company does.",
        "Ninguém promete retorno aos acionistas. Dividendos e ganhos dependem de como a empresa vai.",
      ),
      statement: t(
        "A company must pay its shareholders a minimum return every year.",
        "Uma empresa é obrigada a pagar um retorno mínimo aos acionistas todo ano.",
      ),
    },
    difficulty: -1,
    format: "trueFalse",
    key: "no-guaranteed-return",
    skill: "shareholder-rights",
  },
  {
    content: {
      context: t(
        "Order book: best bid $35.40, best ask $35.46.",
        "Livro de ofertas: melhor compra R$ 35,40, melhor venda R$ 35,46.",
      ),
      options: [
        bankOption(
          t("$35.40", "R$ 35,40"),
          t(
            "To sell now, you accept the best bid.",
            "Para vender agora, você aceita a melhor oferta de compra.",
          ),
        ),
        bankOption(
          t("$35.46", "R$ 35,46"),
          t(
            "That's what sellers are asking. A buyer has to accept it first.",
            "Esse é o preço que os vendedores pedem. Um comprador precisa aceitá-lo antes.",
          ),
          t("Mixed up the bid and the ask", "Confundiu oferta de compra com oferta de venda"),
        ),
        bankOption(
          t("$35.43", "R$ 35,43"),
          t(
            "Nobody has posted that price, so no trade happens there on its own.",
            "Ninguém anunciou esse preço, então nenhum negócio sai ali sozinho.",
          ),
          t("Expects trades to meet halfway", "Espera que o negócio saia no meio do caminho"),
        ),
      ],
      question: t(
        "You want to sell right now. At what price does your sale go through?",
        "Você quer vender agora. Por quanto a venda sai?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "sell-at-bid",
    skill: "order-book",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "People now expect less from the company than before",
            "As pessoas agora esperam menos da empresa do que antes",
          ),
          t(
            "Prices follow expectations. Lower expectations mean lower bids.",
            "Os preços seguem as expectativas. Expectativas menores significam ofertas menores.",
          ),
        ),
        bankOption(
          t("The company lowered the price of its shares", "A empresa baixou o preço das ações"),
          t(
            "Companies don't set the price of their shares on the market.",
            "Empresas não definem o preço das próprias ações na bolsa.",
          ),
          t("Thinks the company sets its share price", "Acha que a empresa define o preço da ação"),
        ),
        bankOption(
          t(
            "The company lost money that same morning",
            "A empresa perdeu dinheiro naquela mesma manhã",
          ),
          t(
            "The company may be exactly the same. Only the expectations changed.",
            "A empresa pode estar igualzinha. Só as expectativas mudaram.",
          ),
          t(
            "Thinks prices move only when the company changes",
            "Acha que o preço só muda quando a empresa muda",
          ),
        ),
      ],
      question: t(
        "A share falls 5% in a morning with no news about the company. What's the most likely reason?",
        "Uma ação cai 5% numa manhã sem nenhuma notícia sobre a empresa. Qual é o motivo mais provável?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "price-falls-no-news",
    skill: "price-last-trade",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Reads an index move as every stock's move",
        "Lê o movimento do índice como o de cada ação",
      ),
      reason: t(
        "An index is a weighted basket: a few big companies can lift it while most stocks fall.",
        "O índice é uma cesta com pesos: algumas grandes empresas podem puxá-lo para cima enquanto a maioria cai.",
      ),
      statement: t(
        "If the market is up 2% today, most stocks went up today.",
        "Se a Bolsa subiu 2% hoje, a maioria das ações subiu hoje.",
      ),
    },
    difficulty: 0,
    format: "trueFalse",
    key: "index-not-every-stock",
    skill: "read-market-headline",
  },
];
