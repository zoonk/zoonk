import { t } from "../../../_utils/localize";
import { guess, option } from "../../content";
import { type SeedLesson } from "../../types";

/**
 * Chapter "What a stock is", lesson 1. Replaces the vague "a stock is something whose price goes
 * up and down" with ownership: a slice of profits, votes and risk, made concrete with one bakery.
 */
export const ownAShareLesson: SeedLesson = {
  canDo: t(
    "You'll explain what you really own when you buy a share, and what you don't.",
    "Você vai explicar o que você tem de verdade quando compra uma ação, e o que não tem.",
  ),
  description: t(
    "A share is a slice of a company. Here's what that slice gives you, and what it doesn't.",
    "Uma ação é uma fatia de uma empresa. Veja o que essa fatia te dá, e o que não dá.",
  ),
  key: "own-a-share",
  minutes: 5,
  skills: ["share-ownership", "shareholder-rights"],
  steps: [
    {
      content: {
        options: [
          guess("slice", t("A small piece of the company", "Um pedacinho da empresa"), true),
          guess(
            "loan",
            t("A loan you made to the company", "Um empréstimo que você fez à empresa"),
          ),
          guess(
            "voucher",
            t("Credit to spend on its products", "Crédito para gastar nos produtos dela"),
          ),
          guess("nothing", t("Nothing, until the price goes up", "Nada, até o preço subir")),
        ],
        question: t(
          "You buy one share of a big bakery chain. What do you own?",
          "Você compra uma ação de uma grande rede de padarias. Do que você passa a ser dono?",
        ),
        reveal: t(
          "A small piece of the company itself: of its profits, its ovens, its brand and its future. Lending money to a company is a different investment, called a bond.",
          "De um pedacinho da própria empresa: dos lucros, dos fornos, da marca e do futuro dela. Emprestar dinheiro a uma empresa é outro investimento, chamado debênture.",
        ),
        variant: "guess",
      },
      kind: "hook",
    },
    {
      content: {
        text: t(
          "A company can split its ownership into millions of equal slices called **shares**. Buy one and you own one slice.\n\nIf the bakery chain has 10 million shares and you hold 1,000, you own 1,000 ÷ 10,000,000 = **0.01%** of it: of every oven, every recipe and every bit of profit.",
          "Uma empresa pode dividir sua propriedade em milhões de fatias iguais chamadas **ações**. Compre uma e você é dono de uma fatia.\n\nSe a rede de padarias tem 10 milhões de ações e você tem 1.000, você é dono de 1.000 ÷ 10.000.000 = **0,01%** dela: de cada forno, cada receita e cada pedaço do lucro.",
        ),
        title: t("A company cut into slices", "Uma empresa fatiada"),
      },
      kind: "explanation",
      skill: "share-ownership",
    },
    {
      content: {
        problem: t(
          "The bakery chain made **$50 million** in profit this year and has 10 million shares. You own 1,000 shares. How much of the profit is yours?",
          "A rede de padarias lucrou **R$ 50 milhões** neste ano e tem 10 milhões de ações. Você tem 1.000 ações. Quanto do lucro é seu?",
        ),
        result: t(
          "$5,000 of the profit is yours. It isn't in your pocket, though: the company decides how much to pay out as dividends and how much to reinvest.",
          "R$ 5.000 do lucro são seus. Mas não estão no seu bolso: a empresa decide quanto pagar em dividendos e quanto reinvestir.",
        ),
        steps: [
          {
            math: t(
              String.raw`\$50{,}000{,}000 \div 10{,}000{,}000 = \$5`,
              String.raw`\text{R\$}\ 50.000.000 \div 10.000.000 = \text{R\$}\ 5`,
            ),
            text: t("First, the profit per share:", "Primeiro, o lucro por ação:"),
          },
          {
            math: t(
              String.raw`\$5 \times 1{,}000 = \$5{,}000`,
              String.raw`\text{R\$}\ 5 \times 1.000 = \text{R\$}\ 5.000`,
            ),
            text: t("Then your 1,000 shares:", "Depois, as suas 1.000 ações:"),
          },
        ],
        title: t("Your slice of the profit", "Sua fatia do lucro"),
      },
      kind: "workedExample",
      skill: "share-ownership",
    },
    {
      content: {
        options: [
          option(
            "lost",
            t("It's lost", "Ela se perdeu"),
            t(
              "It's still yours, now inside the company as new stores. If they earn more, your slice is worth more.",
              "Ela continua sua, agora dentro da empresa, em forma de lojas novas. Se elas lucrarem, sua fatia passa a valer mais.",
            ),
          ),
          option(
            "reinvested",
            t(
              "It's reinvested in the company you partly own",
              "Ela foi reinvestida na empresa da qual você é sócio",
            ),
            t(
              "Right. Profit that isn't paid out stays in the company, and you own a slice of the company.",
              "Isso. O lucro que não é distribuído fica na empresa, e você é dono de uma fatia da empresa.",
            ),
            true,
          ),
          option(
            "bank",
            t(
              "It goes to the bank that lent the company money",
              "Ela vai para o banco que emprestou dinheiro à empresa",
            ),
            t(
              "Lenders get their interest either way. The profit left after that belongs to the shareholders.",
              "Quem emprestou recebe os juros de qualquer jeito. O lucro que sobra depois disso é dos acionistas.",
            ),
          ),
        ],
        question: t(
          "The bakery chain keeps all of this year's profit to open new stores. What happened to your share of the profit?",
          "A rede de padarias guarda todo o lucro do ano para abrir lojas novas. O que aconteceu com a sua parte do lucro?",
        ),
      },
      kind: "check",
      skill: "share-ownership",
    },
    {
      content: {
        text: t(
          "Owning shares gives you:\n\n- A part of the profit the company pays out, called **dividends**\n- A **vote** on big decisions, like electing the board (common shares usually vote; preferred shares usually don't)\n- A slice of whatever the company becomes: if it grows, your slice is worth more\n\nIt doesn't give you a guaranteed return, a say in daily decisions or free products.",
          "Ter ações te dá:\n\n- Uma parte do lucro que a empresa distribui, os **dividendos**\n- **Voto** em grandes decisões, como eleger o conselho (ações ordinárias, com final 3 como PETR3, costumam votar; preferenciais, com final 4 como PETR4, costumam não votar)\n- Uma fatia do que a empresa virar: se ela crescer, sua fatia vale mais\n\nNão te dá retorno garantido, voz nas decisões do dia a dia nem produtos de graça.",
        ),
        title: t("What a shareholder gets", "O que o acionista recebe"),
      },
      kind: "explanation",
      skill: "shareholder-rights",
    },
    {
      content: {
        check: {
          explanation: t(
            "Owning a share means sharing in profits, votes and growth, and in the risk. Nothing about it is guaranteed.",
            "Ser dono de uma ação é dividir lucros, votos e crescimento, e também o risco. Nada disso é garantido.",
          ),
          kind: "interaction",
        },
        fields: {
          groups: [
            {
              id: "gets",
              label: t("Comes with a share", "Vem com a ação"),
              rule: t(
                "Rights that come from owning a slice of the company.",
                "Direitos que vêm de ter uma fatia da empresa.",
              ),
            },
            {
              id: "not",
              label: t("Doesn't come with it", "Não vem com ela"),
              rule: t(
                "Things owners are never promised.",
                "Coisas que nunca são prometidas aos donos.",
              ),
            },
          ],
          items: [
            {
              groupId: "gets",
              id: "dividends",
              text: t("A part of the dividends", "Uma parte dos dividendos"),
              why: t(
                "Profit paid out is split among the shares.",
                "O lucro distribuído é dividido entre as ações.",
              ),
            },
            {
              groupId: "gets",
              id: "vote",
              text: t("A vote on electing the board", "Voto na eleição do conselho"),
              why: t(
                "Common shares vote on big decisions like this one.",
                "Ações ordinárias votam em grandes decisões como essa.",
              ),
            },
            {
              groupId: "gets",
              id: "growth",
              text: t(
                "A slice that's worth more if the company grows",
                "Uma fatia que vale mais se a empresa crescer",
              ),
              why: t(
                "You own part of the company, so you own part of its growth.",
                "Você é dono de parte da empresa, então é dono de parte do crescimento.",
              ),
            },
            {
              groupId: "not",
              id: "guaranteed",
              text: t("A guaranteed return every year", "Um retorno garantido todo ano"),
              why: t(
                "If the company does badly, shareholders can lose money.",
                "Se a empresa for mal, os acionistas podem perder dinheiro.",
              ),
            },
            {
              groupId: "not",
              id: "products",
              text: t("Free products from the company", "Produtos de graça da empresa"),
              why: t(
                "Owners pay for bread like everyone else.",
                "Os donos pagam o pão como todo mundo.",
              ),
            },
            {
              groupId: "not",
              id: "manager",
              text: t(
                "A say in hiring a store manager",
                "Opinar na contratação de um gerente de loja",
              ),
              why: t(
                "Daily decisions belong to the managers the board appoints.",
                "As decisões do dia a dia são dos gestores que o conselho escolhe.",
              ),
            },
          ],
        },
        prompt: t(
          "Sort what a shareholder gets and what they don't.",
          "Separe o que o acionista recebe e o que não recebe.",
        ),
        template: "categorize",
      },
      kind: "activity",
      skill: "shareholder-rights",
    },
    {
      content: {
        options: [
          option(
            "first",
            t("They're paid back first", "Eles são pagos primeiro"),
            t(
              "Lenders, workers and taxes come first. Shareholders are last in line.",
              "Credores, trabalhadores e impostos vêm antes. Os acionistas são os últimos da fila.",
            ),
          ),
          option(
            "last",
            t(
              "They're last in line and often get nothing",
              "Eles são os últimos da fila e muitas vezes não recebem nada",
            ),
            t(
              "Right. Owners share the upside and the downside, and in a bankruptcy they're paid only if something is left.",
              "Isso. Os donos dividem o lado bom e o ruim, e numa falência só recebem se sobrar alguma coisa.",
            ),
            true,
          ),
          option(
            "covered",
            t("The stock exchange covers their losses", "A bolsa cobre o prejuízo"),
            t(
              "Nobody covers a shareholder's loss. That risk is the other side of owning the company.",
              "Ninguém cobre o prejuízo do acionista. Esse risco é o outro lado de ser dono da empresa.",
            ),
          ),
        ],
        question: t(
          "The bakery chain goes bankrupt. What happens to its shareholders?",
          "A rede de padarias vai à falência. O que acontece com os acionistas?",
        ),
      },
      kind: "check",
      skill: "shareholder-rights",
    },
    {
      content: {
        keyPoints: [
          t(
            "A share is a piece of ownership of a company",
            "Uma ação é um pedaço da propriedade de uma empresa",
          ),
          t(
            "Its value and dividends depend on how the company does",
            "O valor e os dividendos dependem de como a empresa vai",
          ),
          t(
            "There's no guaranteed return, unlike a savings account",
            "Não há retorno garantido, ao contrário da poupança",
          ),
        ],
        question: t(
          "A friend thinks buying a share is like putting money in a savings account. In two or three sentences, explain the difference.",
          "Um amigo acha que comprar uma ação é como colocar dinheiro na poupança. Em duas ou três frases, explique a diferença.",
        ),
        sampleAnswer: t(
          "A savings account pays you interest that's promised in advance. A share makes you a part-owner of a company, so what you earn depends on how the company does: it can pay dividends and grow, or lose value. Nobody guarantees the return.",
          "A poupança paga um rendimento combinado de antemão. Uma ação te torna sócio de uma empresa, então o que você ganha depende de como ela vai: pode pagar dividendos e crescer, ou perder valor. Ninguém garante o retorno.",
        ),
      },
      kind: "typedAnswer",
      skill: "shareholder-rights",
    },
    {
      content: {
        ideas: [
          {
            text: t(
              "A share is a slice of a company's ownership.",
              "Uma ação é uma fatia da propriedade de uma empresa.",
            ),
          },
          {
            text: t(
              "Your slice of the profit is profit ÷ shares × the shares you own.",
              "Sua parte do lucro é lucro ÷ número de ações × as ações que você tem.",
            ),
          },
          {
            text: t(
              "Shareholders get dividends, votes (with common shares) and a share of growth.",
              "Acionistas recebem dividendos, voto (nas ações ordinárias) e uma parte do crescimento.",
            ),
          },
          {
            text: t(
              "Nothing is guaranteed, and in a bankruptcy shareholders are paid last.",
              "Nada é garantido, e numa falência os acionistas recebem por último.",
            ),
          },
        ],
      },
      kind: "summary",
    },
  ],
  supportMode: "explanationFirst",
  title: t("What you own when you buy a share", "O que você tem quando compra uma ação"),
};
