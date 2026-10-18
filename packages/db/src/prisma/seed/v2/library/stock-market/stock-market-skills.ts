import { t } from "../../_utils/localize";
import { skill } from "../content";

/** Overview skills: what a stock is, where its price comes from and how to think long term. */
export const stockMarketSkills = [
  skill("share-ownership", "overview", {
    description: t(
      "A share is a small slice of a company: you own a piece of its profits and its future, in proportion to how many shares exist.",
      "Uma ação é uma pequena fatia de uma empresa: você é dono de um pedaço dos lucros e do futuro dela, na proporção de quantas ações existem.",
    ),
    example: t(
      "Owning 1,000 of a company's 10 million shares means owning 0.01% of it.",
      "Ter 1.000 das 10 milhões de ações de uma empresa é ser dono de 0,01% dela.",
    ),
    name: t("Explain what owning a share means", "Explicar o que é ser dono de uma ação"),
    useCase: t(
      "Knowing what you're buying before you put money in the market.",
      "Saber o que você está comprando antes de colocar dinheiro na bolsa.",
    ),
  }),
  skill(
    "shareholder-rights",
    "overview",
    {
      description: t(
        "Shareholders share in the profits and vote on big decisions, but nobody promises them a return.",
        "Acionistas participam dos lucros e votam em grandes decisões, mas ninguém promete retorno a eles.",
      ),
      example: t(
        "If the company goes bankrupt, shareholders are paid last, often nothing.",
        "Se a empresa quebra, os acionistas recebem por último, muitas vezes nada.",
      ),
      name: t(
        "Tell what shareholders get and don't get",
        "Saber o que o acionista recebe e o que não recebe",
      ),
      useCase: t(
        "Weighing the risk of a stock against a savings account.",
        "Comparar o risco de uma ação com o da poupança.",
      ),
    },
    { prerequisites: ["share-ownership"] },
  ),
  skill(
    "ipo",
    "overview",
    {
      description: t(
        "Selling shares raises money to grow without a loan; in exchange, the new owners share the profits.",
        "Vender ações levanta dinheiro para crescer sem empréstimo; em troca, os novos donos dividem os lucros.",
      ),
      name: t("Explain why companies sell shares", "Explicar por que as empresas vendem ações"),
    },
    { prerequisites: ["share-ownership"] },
  ),
  skill(
    "dividends",
    "overview",
    {
      description: t(
        "Dividends are the part of the profit a company pays out to shareholders, per share.",
        "Dividendos são a parte do lucro que a empresa paga aos acionistas, por ação.",
      ),
      name: t("Explain dividends", "Explicar os dividendos"),
    },
    { prerequisites: ["shareholder-rights"] },
  ),
  skill("order-book", "overview", {
    description: t(
      "Buyers post the most they'll pay (bids) and sellers the least they'll accept (asks); a trade happens only when one side accepts the other's price.",
      "Compradores anunciam o máximo que pagam (ofertas de compra) e vendedores o mínimo que aceitam (ofertas de venda); só há negócio quando um lado aceita o preço do outro.",
    ),
    example: t(
      "Best bid $20.10, best ask $20.12: whoever buys right now pays $20.12.",
      "Melhor compra R$ 20,10, melhor venda R$ 20,12: quem compra agora paga R$ 20,12.",
    ),
    name: t("Read an order book", "Ler um livro de ofertas"),
    useCase: t(
      "Knowing what price you'll really pay before you click buy.",
      "Saber que preço você vai pagar de verdade antes de clicar em comprar.",
    ),
  }),
  skill(
    "price-last-trade",
    "overview",
    {
      description: t(
        "The price on the screen is the last trade: it moves whenever buyers or sellers change what they're willing to accept.",
        "O preço na tela é o do último negócio: ele muda sempre que compradores ou vendedores mudam o que aceitam.",
      ),
      example: t(
        "Record profits can sink a stock if investors expected even more.",
        "Um lucro recorde pode derrubar uma ação se os investidores esperavam ainda mais.",
      ),
      name: t(
        "Explain where a stock's price comes from",
        "Explicar de onde vem o preço de uma ação",
      ),
      useCase: t(
        "Reading market news without panicking at every move.",
        "Ler notícias do mercado sem entrar em pânico a cada oscilação.",
      ),
    },
    { prerequisites: ["order-book"] },
  ),
  skill(
    "brokers",
    "overview",
    {
      description: t(
        "A broker sends your order to the exchange, where it meets other people's orders.",
        "A corretora envia sua ordem para a bolsa, onde ela encontra as ordens de outras pessoas.",
      ),
      name: t("Describe brokers and exchanges", "Descrever corretoras e bolsas"),
    },
    { prerequisites: ["order-book"] },
  ),
  skill(
    "indexes",
    "overview",
    {
      description: t(
        "An index tracks a basket of stocks, like the S&P 500 or the Ibovespa, to show how the market as a whole moved.",
        "Um índice acompanha uma cesta de ações, como o Ibovespa ou o S&P 500, para mostrar como o mercado se mexeu como um todo.",
      ),
      name: t("Read a stock index", "Ler um índice de ações"),
    },
    { prerequisites: ["price-last-trade"] },
  ),
  skill(
    "read-market-headline",
    "overview",
    {
      description: t(
        "“The market is up 2%” means an index of big companies is worth 2% more than at yesterday's close.",
        "“A Bolsa subiu 2%” quer dizer que um índice das grandes empresas vale 2% mais que no fechamento de ontem.",
      ),
      example: t(
        "An index that closed at 6,000 points and now stands at 6,120 is up 2%.",
        "Um índice que fechou em 130.000 pontos e agora está em 132.600 subiu 2%.",
      ),
      name: t("Read a headline about the market", "Entender uma manchete sobre a Bolsa"),
    },
    { prerequisites: ["price-last-trade"] },
  ),
  skill(
    "expectations",
    "overview",
    {
      description: t(
        "Prices move when expectations change: good results everyone already expected barely move a stock.",
        "Os preços mudam quando as expectativas mudam: bons resultados que todos já esperavam quase não mexem numa ação.",
      ),
      name: t("Explain why news moves prices", "Explicar por que notícias mexem nos preços"),
    },
    { prerequisites: ["price-last-trade"] },
  ),
  skill(
    "bubbles",
    "overview",
    {
      description: t(
        "When prices rise because people expect them to keep rising, not because of profits, they can fall fast.",
        "Quando os preços sobem porque as pessoas esperam que continuem subindo, e não por causa dos lucros, eles podem cair rápido.",
      ),
      name: t("Describe bubbles and crashes", "Descrever bolhas e quedas"),
    },
    { prerequisites: ["expectations"] },
  ),
  skill("compound-growth", "overview", {
    description: t(
      "Returns earn returns: at 10% a year, money doubles in about 7 years.",
      "O rendimento rende: a 10% ao ano, o dinheiro dobra em cerca de 7 anos.",
    ),
    name: t("Explain compound growth", "Explicar juros sobre juros"),
  }),
  skill(
    "diversification",
    "overview",
    {
      description: t(
        "Owning many different companies means one bad result can't sink everything.",
        "Ter ações de muitas empresas diferentes faz com que um resultado ruim não afunde tudo.",
      ),
      name: t("Explain diversification", "Explicar a diversificação"),
    },
    { prerequisites: ["share-ownership"] },
  ),
  skill(
    "risk-horizon",
    "overview",
    {
      description: t(
        "Stocks swing a lot within a year but have tended to grow over decades; money you need soon belongs somewhere safer.",
        "Ações oscilam muito dentro de um ano, mas costumam crescer ao longo de décadas; dinheiro que você vai usar logo fica melhor em algo mais seguro.",
      ),
      name: t("Match risk to time", "Combinar risco e prazo"),
    },
    { prerequisites: ["compound-growth", "diversification"] },
  ),
];
