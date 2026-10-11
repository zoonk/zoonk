import { t } from "../../_utils/localize";
import { bankOption } from "../content";
import { type SeedItem } from "../types";

/**
 * Phase challenge questions on the whole stock market course. With the course's other items, every phase
 * on a seeded learner's plan has enough questions for its challenge, on any day of the plan.
 */
export const stockMarketChallengeItems: SeedItem[] = [
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "A sale at whatever buyers are bidding right now, which may be below that price",
            "Uma venda pelo que os compradores oferecem agora, que pode ficar abaixo desse preço",
          ),
          t(
            "The price on the screen is the last trade. Your sale happens at the bids waiting now, and a big sale can use up the best ones.",
            "O preço na tela é o do último negócio. Sua venda sai pelas ofertas de compra que estão esperando agora, e uma venda grande pode esgotar as melhores.",
          ),
        ),
        bankOption(
          t(
            "A sale of every share at exactly the price on the screen",
            "Uma venda de todas as ações exatamente pelo preço da tela",
          ),
          t(
            "That price was agreed by two other people a moment ago. Nobody has to pay it again.",
            "Esse preço foi combinado por outras duas pessoas há um instante. Ninguém é obrigado a pagá-lo de novo.",
          ),
          t(
            "Thinks the screen price is a price anyone will pay",
            "Acha que o preço da tela é um preço que qualquer um vai pagar",
          ),
        ),
        bankOption(
          t(
            "A price the exchange guarantees for a few minutes",
            "Um preço que a bolsa garante por alguns minutos",
          ),
          t(
            "The exchange only matches orders. It never promises a price to anyone.",
            "A bolsa só junta as ordens. Ela nunca promete preço a ninguém.",
          ),
          t(
            "Thinks the exchange guarantees the displayed price",
            "Acha que a bolsa garante o preço exibido",
          ),
        ),
      ],
      question: t(
        "A stock shows $42.00 on the screen and you sell 1,000 shares now. What should you expect?",
        "Uma ação aparece a R$ 42,00 na tela e você vende 1.000 ações agora. O que você deve esperar?",
      ),
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "screen-price-not-guaranteed",
    skill: "price-last-trade",
  },
  {
    content: {
      context: t(
        "Best bid: $20.10. Best ask: $20.15. You send a buy order with a limit of $20.12.",
        "Melhor oferta de compra: R$ 20,10. Melhor oferta de venda: R$ 20,15. Você envia uma ordem de compra limitada a R$ 20,12.",
      ),
      options: [
        bankOption(
          t(
            "It waits in the book as the new best bid until a seller accepts it",
            "Ela fica no livro como a nova melhor oferta de compra até um vendedor aceitar",
          ),
          t(
            "No seller is asking that little yet, so your order waits. It now tops the bids.",
            "Nenhum vendedor pede tão pouco ainda, então sua ordem espera. Agora ela é a melhor oferta de compra.",
          ),
        ),
        bankOption(
          t("It buys at once at $20.15", "Ela compra na hora a R$ 20,15"),
          t(
            "A limit order never pays more than its limit, and $20.15 is above it.",
            "Uma ordem limitada nunca paga mais que o limite, e R$ 20,15 está acima dele.",
          ),
          t(
            "Thinks any order trades immediately at the ask",
            "Acha que qualquer ordem é executada na hora pelo preço de venda",
          ),
        ),
        bankOption(
          t("It buys at once at $20.12", "Ela compra na hora a R$ 20,12"),
          t(
            "A trade needs a seller who accepts that price, and nobody is offering it yet.",
            "Um negócio precisa de um vendedor que aceite esse preço, e ninguém está oferecendo isso ainda.",
          ),
          t(
            "Expects buyers and sellers to meet halfway on their own",
            "Espera que compradores e vendedores se encontrem no meio sozinhos",
          ),
        ),
        bankOption(
          t(
            "It's rejected, because that price isn't in the book",
            "Ela é rejeitada, porque esse preço não está no livro",
          ),
          t(
            "Any price is allowed. A new order simply joins the book at its own price.",
            "Qualquer preço é permitido. Uma ordem nova simplesmente entra no livro com o próprio preço.",
          ),
          t(
            "Thinks orders must match a price already posted",
            "Acha que a ordem precisa bater com um preço já anunciado",
          ),
        ),
      ],
      question: t("What happens to your order?", "O que acontece com a sua ordem?"),
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "limit-between-bid-ask",
    skill: "order-book",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks the bid-ask spread is a fee",
        "Acha que a diferença entre compra e venda é uma taxa",
      ),
      reason: t(
        "The spread is only the distance between what buyers offer and what sellers ask. Nobody collects it as a fee, but buying or selling right away means crossing it.",
        "A diferença é só a distância entre o que os compradores oferecem e o que os vendedores pedem. Ninguém a cobra como taxa, mas comprar ou vender na hora significa atravessá-la.",
      ),
      statement: t(
        "The gap between the best bid and the best ask is a fee the exchange charges on each trade.",
        "A diferença entre a melhor oferta de compra e a melhor oferta de venda é uma taxa que a bolsa cobra em cada negócio.",
      ),
    },
    difficulty: 0,
    format: "trueFalse",
    key: "spread-not-a-fee",
    skill: "order-book",
  },
  {
    content: {
      context: null,
      math: {
        answer: 4000,
        commonMistakes: [
          {
            expression: "profit / total",
            misconception: t("Stopped at the profit per share", "Parou no lucro por ação"),
            reason: t(
              "That's what one share is entitled to. You own many shares.",
              "Isso é o que cabe a uma ação. Você tem várias.",
            ),
          },
          {
            expression: "profit * owned",
            misconception: t(
              "Forgot to split the profit among all the shares",
              "Esqueceu de dividir o lucro entre todas as ações",
            ),
            reason: t(
              "The profit belongs to every share, so first divide it by all of them.",
              "O lucro pertence a todas as ações, então primeiro divida por todas elas.",
            ),
          },
        ],
        solution: "profit / total * owned",
        steps: [
          {
            expression: "profit / total",
            text: t(
              "Profit per share: {profit} million ÷ {total} million shares = {result}",
              "Lucro por ação: {profit} milhões ÷ {total} milhões de ações = {result}",
            ),
          },
          {
            expression: "profit / total * owned",
            text: t("Your {owned} shares: {result}", "As suas {owned} ações: {result}"),
          },
        ],
        tolerance: { kind: "relative", value: 0.001 },
        unit: t("$", "R$"),
        variables: [
          { max: 900, min: 50, name: "profit", step: 50, unit: t("$", "R$"), value: 200 },
          { max: 200, min: 10, name: "total", step: 10, unit: null, value: 50 },
          { max: 10_000, min: 100, name: "owned", step: 100, unit: null, value: 1000 },
        ],
      },
      question: t(
        "A company has {total} million shares and made a profit of {profit} million dollars this year. You own {owned} shares. How much of that profit belongs to your stake, in dollars?",
        "Uma empresa tem {total} milhões de ações e teve lucro de R$ {profit} milhões neste ano. Você tem {owned} ações. Quanto desse lucro pertence à sua parte, em reais?",
      ),
    },
    difficulty: 0,
    format: "numeric",
    key: "stake-of-profit",
    skill: "share-ownership",
  },
  {
    content: {
      context: t(
        "A company has 1 million shares. It issues 1 million new shares to raise money. You own 10,000 shares and buy none of the new ones.",
        "Uma empresa tem 1 milhão de ações. Ela emite mais 1 milhão de ações novas para levantar dinheiro. Você tem 10.000 ações e não compra nenhuma das novas.",
      ),
      options: [
        bankOption(
          t(
            "You keep your shares, but your slice of the company is half as big",
            "Você continua com as suas ações, mas a sua fatia da empresa cai pela metade",
          ),
          t(
            "Your stake is your shares out of all the shares. The total doubled, so your fraction halved.",
            "A sua parte é a sua quantidade de ações sobre o total. O total dobrou, então a sua fração caiu pela metade.",
          ),
        ),
        bankOption(
          t(
            "Nothing changes, since you still have the same shares",
            "Nada muda, já que você continua com as mesmas ações",
          ),
          t(
            "Owning a share means owning a fraction of the company, and that fraction depends on how many shares exist.",
            "Ter uma ação é ter uma fração da empresa, e essa fração depende de quantas ações existem.",
          ),
          t(
            "Thinks a stake is a number of shares, not a fraction of the company",
            "Acha que a participação é um número de ações, e não uma fração da empresa",
          ),
        ),
        bankOption(
          t(
            "The company takes back half of your shares",
            "A empresa pega de volta metade das suas ações",
          ),
          t(
            "Nobody takes your shares. They're just worth a smaller part of a company with more shares.",
            "Ninguém tira as suas ações. Elas só passam a valer uma parte menor de uma empresa com mais ações.",
          ),
          t(
            "Thinks issuing shares removes old shareholders' shares",
            "Acha que emitir ações tira ações dos antigos acionistas",
          ),
        ),
        bankOption(
          t(
            "Your slice grows, since the company now has more money",
            "A sua fatia cresce, já que a empresa agora tem mais dinheiro",
          ),
          t(
            "The company may be worth more, but the new money came with new owners who share it.",
            "A empresa pode valer mais, mas o dinheiro novo veio com novos donos, que dividem tudo com você.",
          ),
          t(
            "Thinks new money raises old owners' fraction",
            "Acha que dinheiro novo aumenta a fração dos antigos donos",
          ),
        ),
      ],
      question: t(
        "What happens to your ownership of the company?",
        "O que acontece com a sua participação na empresa?",
      ),
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "new-shares-dilute",
    skill: "share-ownership",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "To the company, to pay for its plans, like new stores or factories",
            "Para a empresa, para pagar os planos dela, como novas lojas ou fábricas",
          ),
          t(
            "New shares sold in an IPO raise money for the company itself. That's why it sells them.",
            "As ações novas vendidas num IPO levantam dinheiro para a própria empresa. É por isso que ela as vende.",
          ),
        ),
        bankOption(
          t("To the stock exchange, which runs the sale", "Para a bolsa, que organiza a venda"),
          t(
            "The exchange charges fees, but the money for new shares goes to the company.",
            "A bolsa cobra taxas, mas o dinheiro das ações novas vai para a empresa.",
          ),
          t(
            "Thinks the exchange keeps the money from a share sale",
            "Acha que a bolsa fica com o dinheiro da venda de ações",
          ),
        ),
        bankOption(
          t(
            "To a fund that pays it back to buyers with interest",
            "Para um fundo que devolve o dinheiro aos compradores com juros",
          ),
          t(
            "Shares are never paid back with interest. Buyers become owners and share the risk.",
            "Ações nunca são devolvidas com juros. Os compradores viram donos e dividem o risco.",
          ),
          t("Confuses shares with a loan", "Confunde ações com empréstimo"),
        ),
      ],
      question: t(
        "In an IPO, a company sells new shares to the public for the first time. Where does the money from those new shares go?",
        "Num IPO, uma empresa vende ações novas ao público pela primeira vez. Para onde vai o dinheiro dessas ações novas?",
      ),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "ipo-money-goes",
    skill: "ipo",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks every share purchase sends money to the company",
        "Acha que toda compra de ação manda dinheiro para a empresa",
      ),
      reason: t(
        "After the IPO, shares change hands between investors. Your money goes to the investor who sold to you.",
        "Depois do IPO, as ações passam de um investidor para outro. O seu dinheiro vai para o investidor que vendeu para você.",
      ),
      statement: t(
        "Years after a company's IPO, when you buy its shares on the exchange, your money goes to the company.",
        "Anos depois do IPO de uma empresa, quando você compra ações dela na bolsa, o seu dinheiro vai para a empresa.",
      ),
    },
    difficulty: 0,
    format: "trueFalse",
    key: "later-buys-go-to-sellers",
    skill: "ipo",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "It never has to repay the money or pay interest, but the new owners share its future profits",
            "Ela nunca precisa devolver o dinheiro nem pagar juros, mas os novos donos dividem os lucros futuros",
          ),
          t(
            "That's the trade: no debt to repay, in exchange for giving up part of the company.",
            "Essa é a troca: nenhuma dívida para pagar, em troca de abrir mão de parte da empresa.",
          ),
        ),
        bankOption(
          t(
            "Selling shares costs the company nothing at all",
            "Vender ações não custa nada para a empresa",
          ),
          t(
            "The founders give up part of the profits and of the control, which can cost more than interest.",
            "Os fundadores abrem mão de parte dos lucros e do controle, o que pode custar mais que juros.",
          ),
          t("Thinks issuing shares is free money", "Acha que emitir ações é dinheiro de graça"),
        ),
        bankOption(
          t(
            "Shareholders accept lower interest than a bank does",
            "Os acionistas aceitam juros menores que os de um banco",
          ),
          t(
            "Shareholders get no interest at all. They get a share of profits, if there are any.",
            "Os acionistas não recebem juros. Eles recebem parte dos lucros, se houver.",
          ),
          t(
            "Thinks shareholders are paid like lenders",
            "Acha que acionistas são pagos como credores",
          ),
        ),
      ],
      question: t(
        "Why might a growing company sell shares instead of taking a bank loan?",
        "Por que uma empresa em crescimento pode preferir vender ações a pegar um empréstimo no banco?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "shares-instead-of-loan",
    skill: "ipo",
  },
  {
    content: {
      context: null,
      math: {
        answer: 0.8,
        commonMistakes: [
          {
            expression: "profit / shares",
            misconception: t(
              "Gave the profit per share as the dividend",
              "Deu o lucro por ação como dividendo",
            ),
            reason: t(
              "Only the part of the profit the company pays out becomes dividends.",
              "Só a parte do lucro que a empresa distribui vira dividendo.",
            ),
          },
          {
            expression: "profit * payout / 100",
            misconception: t(
              "Gave the total paid out instead of the amount per share",
              "Deu o total distribuído em vez do valor por ação",
            ),
            reason: t(
              "That total is split among every share.",
              "Esse total é dividido entre todas as ações.",
            ),
          },
        ],
        solution: "profit * payout / 100 / shares",
        steps: [
          {
            expression: "profit * payout / 100",
            text: t(
              "Paid out: {payout}% of {profit} million = {result} million",
              "Distribuído: {payout}% de {profit} milhões = {result} milhões",
            ),
          },
          {
            expression: "profit * payout / 100 / shares",
            text: t(
              "Per share: that amount ÷ {shares} million shares = {result}",
              "Por ação: esse valor ÷ {shares} milhões de ações = {result}",
            ),
          },
        ],
        tolerance: { kind: "absolute", value: 0.01 },
        unit: t("$", "R$"),
        variables: [
          { max: 2000, min: 100, name: "profit", step: 100, unit: t("$", "R$"), value: 500 },
          { max: 100, min: 25, name: "payout", step: 5, unit: "%", value: 40 },
          { max: 1000, min: 100, name: "shares", step: 50, unit: null, value: 250 },
        ],
      },
      question: t(
        "A company made a profit of {profit} million dollars and pays out {payout}% of it as dividends. It has {shares} million shares. How much does each share receive, in dollars?",
        "Uma empresa teve lucro de R$ {profit} milhões e distribui {payout}% dele como dividendos. Ela tem {shares} milhões de ações. Quanto cada ação recebe, em reais?",
      ),
    },
    difficulty: 0,
    format: "numeric",
    key: "dividend-per-share",
    skill: "dividends",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks past dividends are guaranteed to continue",
        "Acha que os dividendos passados estão garantidos",
      ),
      reason: t(
        "Dividends come out of each year's profit. If profit falls, dividends usually fall too, and with no profit there may be none.",
        "O dividendo sai do lucro de cada ano. Se o lucro cai, o dividendo costuma cair junto, e sem lucro pode não haver nenhum.",
      ),
      statement: t(
        "A company that paid $2 per share in dividends last year must pay at least that much this year.",
        "Uma empresa que pagou R$ 2 por ação em dividendos no ano passado é obrigada a pagar pelo menos isso neste ano.",
      ),
    },
    difficulty: -1,
    format: "trueFalse",
    key: "dividends-can-shrink",
    skill: "dividends",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Another investor, whose sell order meets yours on the exchange",
            "Outro investidor, cuja ordem de venda encontra a sua na bolsa",
          ),
          t(
            "The broker only carries your order to the exchange, where it meets someone who wants to sell.",
            "A corretora só leva a sua ordem até a bolsa, onde ela encontra alguém que quer vender.",
          ),
        ),
        bankOption(
          t("The broker, out of its own stock of shares", "A corretora, do estoque de ações dela"),
          t(
            "The broker is the messenger, not the seller. The shares come from another investor.",
            "A corretora é a mensageira, não a vendedora. As ações vêm de outro investidor.",
          ),
          t(
            "Thinks the broker sells you the shares",
            "Acha que a corretora vende as ações para você",
          ),
        ),
        bankOption(
          t("The company that issued the shares", "A empresa que emitiu as ações"),
          t(
            "The company sold its shares long ago. Today they trade between investors.",
            "A empresa vendeu as ações há muito tempo. Hoje elas são negociadas entre investidores.",
          ),
          t(
            "Thinks every purchase is bought from the company",
            "Acha que toda compra é feita da própria empresa",
          ),
        ),
        bankOption(
          t(
            "The exchange, which owns the shares listed on it",
            "A bolsa, que é dona das ações listadas nela",
          ),
          t(
            "The exchange owns none of those shares. It only runs the place where orders meet.",
            "A bolsa não é dona dessas ações. Ela só organiza o lugar onde as ordens se encontram.",
          ),
          t(
            "Thinks the exchange owns the listed shares",
            "Acha que a bolsa é dona das ações listadas",
          ),
        ),
      ],
      question: t(
        "You tap buy in your broker's app and the order goes through. Who sold you the shares?",
        "Você toca em comprar no app da corretora e a ordem é executada. Quem vendeu as ações para você?",
      ),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "who-sells-to-you",
    skill: "brokers",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks your shares belong to the broker",
        "Acha que as suas ações pertencem à corretora",
      ),
      reason: t(
        "Brokers must keep clients' shares apart from their own assets. If a broker fails, the shares are yours and are moved to another broker.",
        "As ações ficam registradas no seu nome na central depositária da B3, separadas do patrimônio da corretora. Se ela quebrar, você as transfere para outra corretora.",
      ),
      statement: t(
        "If your broker goes out of business, the shares you bought through it are lost.",
        "Se a sua corretora fechar, as ações que você comprou por ela se perdem.",
      ),
    },
    difficulty: 0,
    format: "trueFalse",
    key: "broker-fails-shares-safe",
    skill: "brokers",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "It runs the market where buy and sell orders meet, and records each trade",
            "Organiza o mercado onde as ordens de compra e venda se encontram, e registra cada negócio",
          ),
          t(
            "The exchange is the meeting place. Prices come from what buyers and sellers agree on there.",
            "A bolsa é o ponto de encontro. Os preços saem do que compradores e vendedores combinam ali.",
          ),
        ),
        bankOption(
          t(
            "It decides what each company's shares are worth",
            "Decide quanto valem as ações de cada empresa",
          ),
          t(
            "Nobody sets the price. It's whatever the last buyer and seller agreed on.",
            "Ninguém define o preço. Ele é o que o último comprador e o último vendedor combinaram.",
          ),
          t("Thinks the exchange sets share prices", "Acha que a bolsa define o preço das ações"),
        ),
        bankOption(
          t(
            "It buys the shares nobody else wants, so you can always sell",
            "Compra as ações que ninguém quer, para você sempre conseguir vender",
          ),
          t(
            "The exchange never buys. If nobody bids, you wait or accept a lower price.",
            "A bolsa nunca compra. Se ninguém oferece, você espera ou aceita um preço menor.",
          ),
          t(
            "Thinks there's always a guaranteed buyer",
            "Acha que sempre existe um comprador garantido",
          ),
        ),
        bankOption(
          t(
            "It lends money to the companies listed on it",
            "Empresta dinheiro às empresas listadas",
          ),
          t(
            "That's what banks do. The exchange doesn't lend.",
            "Isso é o que os bancos fazem. A bolsa não empresta.",
          ),
          t("Confuses an exchange with a bank", "Confunde a bolsa com um banco"),
        ),
      ],
      question: t(
        "What does a stock exchange like the NYSE do?",
        "O que uma bolsa de valores como a B3 faz?",
      ),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "what-exchange-does",
    skill: "brokers",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "A 5% rise in the biggest company in the index",
            "Uma alta de 5% na maior empresa do índice",
          ),
          t(
            "In an index weighted by company size, the biggest companies carry the most weight.",
            "Num índice ponderado pelo tamanho das empresas, as maiores têm o maior peso.",
          ),
        ),
        bankOption(
          t(
            "A 5% rise in the smallest company in the index",
            "Uma alta de 5% na menor empresa do índice",
          ),
          t(
            "A small company is a small slice of the basket, so its move barely shows.",
            "Uma empresa pequena é uma fatia pequena da cesta, então o movimento dela quase não aparece.",
          ),
          t(
            "Thinks smaller companies weigh more in an index",
            "Acha que empresas menores pesam mais no índice",
          ),
        ),
        bankOption(
          t(
            "Both the same, since each company counts once",
            "Os dois igualmente, já que cada empresa conta uma vez",
          ),
          t(
            "Each company counts by its market value, not once each.",
            "Cada empresa conta pelo seu valor de mercado, não uma vez cada.",
          ),
          t(
            "Thinks every stock has the same weight in an index",
            "Acha que toda ação tem o mesmo peso no índice",
          ),
        ),
      ],
      question: t(
        "The S&P 500 weighs each company by its market value. Which move changes the index more?",
        "O Ibovespa pesa cada empresa pelo seu valor de mercado. Qual movimento muda mais o índice?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "index-weight-by-size",
    skill: "indexes",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "The stocks in it, weighted by size, are worth 10% more as a whole",
            "As ações dele, pesadas pelo tamanho, valem 10% mais no conjunto",
          ),
          t(
            "Index points only matter as a change: from 4,000 to 4,400 is a 10% rise in the basket.",
            "Os pontos do índice só importam como variação: de 120.000 para 132.000 é uma alta de 10% na cesta.",
          ),
        ),
        bankOption(
          t(
            "Each of its shares gained that many dollars",
            "Cada uma das ações ganhou essa quantidade de reais",
          ),
          t(
            "Points aren't money per share. They're a scale that tracks the basket's value.",
            "Pontos não são dinheiro por ação. São uma escala que acompanha o valor da cesta.",
          ),
          t("Reads index points as money", "Lê os pontos do índice como dinheiro"),
        ),
        bankOption(
          t("More companies joined the index", "Mais empresas entraram no índice"),
          t(
            "Points don't count companies. The list changes only in periodic reviews.",
            "Pontos não contam empresas. A lista só muda nas revisões periódicas.",
          ),
          t("Thinks index points count companies", "Acha que os pontos contam empresas"),
        ),
      ],
      question: t(
        "Over a year, the S&P 500 goes from 4,000 to 4,400 points. What does that mean?",
        "Em um ano, o Ibovespa vai de 120.000 para 132.000 pontos. O que isso significa?",
      ),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "index-points-meaning",
    skill: "indexes",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Investors expected even more, so the result disappointed them",
            "Os investidores esperavam ainda mais, então o resultado decepcionou",
          ),
          t(
            "The price already counted on a great year. What moves it is the gap between result and expectation.",
            "O preço já contava com um ano ótimo. O que mexe nele é a diferença entre o resultado e a expectativa.",
          ),
        ),
        bankOption(
          t(
            "The report must have had a mistake, since good news always lifts a stock",
            "O balanço devia ter algum erro, já que notícia boa sempre faz a ação subir",
          ),
          t(
            "Good news lifts a stock only if it's better than people expected.",
            "Notícia boa só faz a ação subir se for melhor do que se esperava.",
          ),
          t(
            "Thinks good news always lifts the price",
            "Acha que notícia boa sempre faz o preço subir",
          ),
        ),
        bankOption(
          t(
            "Shares always fall on the day results come out",
            "As ações sempre caem no dia em que sai o resultado",
          ),
          t(
            "There's no such rule. Stocks rise or fall on results depending on what was expected.",
            "Não existe essa regra. As ações sobem ou caem no resultado conforme o que se esperava.",
          ),
          t(
            "Thinks results days follow a fixed pattern",
            "Acha que dia de resultado segue um padrão fixo",
          ),
        ),
        bankOption(
          t(
            "The company lowered its share price after the report",
            "A empresa baixou o preço da ação depois do balanço",
          ),
          t(
            "Companies don't set their share price. Buyers and sellers do.",
            "Empresas não definem o preço da ação. Compradores e vendedores definem.",
          ),
          t("Thinks the company sets its share price", "Acha que a empresa define o preço da ação"),
        ),
      ],
      question: t(
        "A company reports record profits, up 20% on last year, and its shares fall 6% that day. What's the most likely reason?",
        "Uma empresa divulga lucro recorde, 20% maior que no ano anterior, e as ações caem 6% no mesmo dia. Qual é o motivo mais provável?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "record-profit-falls",
    skill: "expectations",
  },
  {
    content: {
      context: null,
      isTrue: true,
      misconception: null,
      reason: t(
        "The price already reflected that result. With nothing new to learn, there's little reason to buy or sell.",
        "O preço já refletia esse resultado. Sem nada novo para saber, há pouco motivo para comprar ou vender.",
      ),
      statement: t(
        "When a company's results come out exactly as everyone expected, its stock usually barely moves.",
        "Quando o resultado de uma empresa sai exatamente como todo mundo esperava, a ação costuma mexer pouco.",
      ),
    },
    difficulty: -1,
    format: "trueFalse",
    key: "expected-results-flat",
    skill: "expectations",
  },
  {
    content: {
      context: t(
        "A drug company's shares jump 30% in one day, the day a health regulator approves its new medicine. It hasn't sold a single box yet.",
        "As ações de uma farmacêutica sobem 30% num dia, no dia em que a Anvisa aprova o seu novo remédio. Ela ainda não vendeu nenhuma caixa.",
      ),
      options: [
        bankOption(
          t(
            "Investors now expect bigger profits in the years ahead",
            "Os investidores agora esperam lucros maiores nos próximos anos",
          ),
          t(
            "A price is a bet on future profits, so it moves the day the outlook changes, long before the sales arrive.",
            "O preço é uma aposta nos lucros futuros, então ele muda no dia em que a perspectiva muda, muito antes das vendas.",
          ),
        ),
        bankOption(
          t("The company's profit rose 30% that day", "O lucro da empresa subiu 30% naquele dia"),
          t(
            "It hasn't sold anything yet. Today's profit didn't change, the outlook did.",
            "Ela ainda não vendeu nada. O lucro de hoje não mudou, a perspectiva mudou.",
          ),
          t(
            "Thinks prices follow only current profits",
            "Acha que os preços seguem só o lucro atual",
          ),
        ),
        bankOption(
          t(
            "The jump is a mistake that the exchange will undo",
            "A alta é um erro que a bolsa vai desfazer",
          ),
          t(
            "Real trades happened at those prices. The exchange doesn't undo prices it dislikes.",
            "Negócios reais aconteceram nesses preços. A bolsa não desfaz preços de que não gosta.",
          ),
          t(
            "Thinks a price must be backed by sales already made",
            "Acha que o preço precisa de vendas já feitas para se sustentar",
          ),
        ),
      ],
      question: t("Why did the shares jump?", "Por que as ações subiram?"),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "approval-lifts-stock",
    skill: "expectations",
  },
  {
    content: {
      context: t(
        "For weeks, every analyst predicted the central bank would raise interest rates by half a point. It did exactly that, and stocks barely moved.",
        "Durante semanas, todos os analistas previram que o Banco Central subiria os juros em meio ponto. Ele fez exatamente isso, e as ações quase não se mexeram.",
      ),
      options: [
        bankOption(
          t(
            "The rise was already in prices before it was announced",
            "A alta já estava nos preços antes do anúncio",
          ),
          t(
            "Investors had adjusted their bids while they waited. Only a surprise would have moved prices.",
            "Os investidores ajustaram as ofertas enquanto esperavam. Só uma surpresa teria mexido nos preços.",
          ),
        ),
        bankOption(
          t("Interest rates don't affect stock prices", "Os juros não afetam o preço das ações"),
          t(
            "They do: higher rates make safe investments pay more and loans cost more. Here, the change was simply expected.",
            "Afetam: juros mais altos fazem os investimentos seguros renderem mais e os empréstimos custarem mais. Aqui, a mudança só era esperada.",
          ),
          t(
            "Thinks interest rates don't matter for stocks",
            "Acha que os juros não importam para as ações",
          ),
        ),
        bankOption(
          t(
            "Investors hadn't heard the news yet",
            "Os investidores ainda não tinham ouvido a notícia",
          ),
          t(
            "A central bank decision reaches everyone in seconds. Prices didn't move because nothing new was learned.",
            "Uma decisão do Banco Central chega a todos em segundos. Os preços não mexeram porque não havia nada novo.",
          ),
          t(
            "Thinks markets react slowly to public news",
            "Acha que o mercado reage devagar a notícias públicas",
          ),
        ),
      ],
      question: t("Why did stocks barely move?", "Por que as ações quase não se mexeram?"),
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "expected-rate-hike",
    skill: "expectations",
  },
  {
    content: {
      context: t(
        "Two companies each grew profits by 10% last year. Investors expected the first to grow 5% and the second to grow 25%.",
        "Duas empresas aumentaram o lucro em 10% no ano passado. Os investidores esperavam que a primeira crescesse 5% e a segunda, 25%.",
      ),
      options: [
        bankOption(
          t(
            "The first one, which beat what was expected",
            "A primeira, que superou o que se esperava",
          ),
          t(
            "Same result, different surprise: the first did better than expected, the second worse.",
            "Mesmo resultado, surpresas diferentes: a primeira foi melhor que o esperado, a segunda, pior.",
          ),
        ),
        bankOption(
          t(
            "The second one, which investors liked more",
            "A segunda, de que os investidores gostavam mais",
          ),
          t(
            "High hopes were already in its price. Growing less than hoped tends to push it down.",
            "As grandes esperanças já estavam no preço. Crescer menos que o esperado tende a derrubá-lo.",
          ),
          t(
            "Judges a result without comparing it to expectations",
            "Julga o resultado sem comparar com as expectativas",
          ),
        ),
        bankOption(
          t("Both the same, since both grew equally", "As duas igualmente, já que cresceram igual"),
          t(
            "Prices react to the surprise, not to the result alone.",
            "Os preços reagem à surpresa, não só ao resultado.",
          ),
          t("Thinks prices react to the result alone", "Acha que os preços reagem só ao resultado"),
        ),
      ],
      question: t(
        "Which stock most likely rose more when the results came out?",
        "Qual ação provavelmente subiu mais quando os resultados saíram?",
      ),
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "beat-vs-miss",
    skill: "expectations",
  },
  {
    content: {
      context: t(
        "A tech company's shares tripled in a year while its profits stayed flat. On social media, people say it \"only goes up\" and buy so they don't miss out.",
        'As ações de uma empresa de tecnologia triplicaram em um ano enquanto o lucro ficou parado. Nas redes sociais, as pessoas dizem que ela "só sobe" e compram para não ficar de fora.',
      ),
      options: [
        bankOption(
          t(
            "The price depends on new buyers arriving, so it can fall fast when they stop",
            "O preço depende de novos compradores chegando, então pode cair rápido quando eles pararem",
          ),
          t(
            "Without profits behind it, the rise lasts only while people expect it to keep rising.",
            "Sem lucro por trás, a alta só dura enquanto as pessoas esperam que ela continue.",
          ),
        ),
        bankOption(
          t(
            "Little risk: it has gone up all year, so it will keep going up",
            "Pouco risco: subiu o ano todo, então vai continuar subindo",
          ),
          t(
            "A past rise says nothing about the next one, least of all when profits didn't grow.",
            "Uma alta passada não garante a próxima, menos ainda quando o lucro não cresceu.",
          ),
          t(
            "Thinks a past trend guarantees the future",
            "Acha que a tendência passada garante o futuro",
          ),
        ),
        bankOption(
          t(
            "Little risk: so many people buying proves it's worth that much",
            "Pouco risco: tanta gente comprando prova que ela vale isso",
          ),
          t(
            "A crowd buying shows enthusiasm, not value. Crowds also sell together.",
            "Muita gente comprando mostra empolgação, não valor. A multidão também vende junta.",
          ),
          t("Thinks popularity means safety", "Acha que popularidade é segurança"),
        ),
      ],
      question: t(
        "What's the main risk in buying these shares now?",
        "Qual é o principal risco de comprar essas ações agora?",
      ),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "only-goes-up",
    skill: "bubbles",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Expects crashes to unwind as slowly as the rise",
        "Espera que a queda seja tão lenta quanto a alta",
      ),
      reason: t(
        "Once people stop expecting more gains, many try to sell at once. Falls are often much faster than the climb.",
        "Quando as pessoas param de esperar novas altas, muitas tentam vender ao mesmo tempo. A queda costuma ser bem mais rápida que a subida.",
      ),
      statement: t(
        "When a bubble bursts, prices usually come down about as slowly as they went up.",
        "Quando uma bolha estoura, os preços costumam cair mais ou menos tão devagar quanto subiram.",
      ),
    },
    difficulty: 0,
    format: "trueFalse",
    key: "crash-faster-than-rise",
    skill: "bubbles",
  },
  {
    content: {
      context: t(
        "In the late 1990s, internet companies with no profits saw their shares soar. From its peak in 2000 to 2002, the Nasdaq index lost nearly 80% of its value.",
        "No fim dos anos 1990, empresas de internet sem lucro viram suas ações dispararem. Do pico em 2000 até 2002, o índice Nasdaq perdeu quase 80% do valor.",
      ),
      options: [
        bankOption(
          t(
            "Expectations of future profits ran far ahead of what the companies earned",
            "As expectativas de lucro futuro correram muito à frente do que as empresas ganhavam",
          ),
          t(
            "Buyers paid for profits they imagined. When those didn't come, the prices had nothing to stand on.",
            "Os compradores pagaram por lucros que imaginavam. Quando eles não vieram, os preços ficaram sem sustentação.",
          ),
        ),
        bankOption(
          t(
            "The companies' profits were growing just as fast",
            "Os lucros das empresas cresciam na mesma velocidade",
          ),
          t(
            "Many had no profits at all. Prices rose on hopes, not on earnings.",
            "Muitas nem tinham lucro. Os preços subiram com esperanças, não com ganhos.",
          ),
          t("Thinks every rise is backed by profits", "Acha que toda alta tem lucro por trás"),
        ),
        bankOption(
          t(
            "The exchange raised prices to attract investors",
            "A bolsa subiu os preços para atrair investidores",
          ),
          t(
            "Exchanges don't set prices. Buyers bidding more did.",
            "A bolsa não define preços. Foram os compradores oferecendo mais.",
          ),
          t("Thinks the exchange sets prices", "Acha que a bolsa define os preços"),
        ),
        bankOption(
          t(
            "Governments promised that tech shares wouldn't fall",
            "Os governos prometeram que as ações de tecnologia não cairiam",
          ),
          t(
            "No one guarantees share prices, as the crash showed.",
            "Ninguém garante o preço de ações, como a queda mostrou.",
          ),
          t("Thinks someone guarantees share prices", "Acha que alguém garante o preço das ações"),
        ),
      ],
      question: t(
        "What drove the rise before the crash?",
        "O que impulsionou a alta antes da queda?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "dot-com-rise",
    skill: "bubbles",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "People buy mainly to sell higher soon, while the company's profits don't grow",
            "As pessoas compram principalmente para vender mais caro logo, enquanto o lucro da empresa não cresce",
          ),
          t(
            "That's the mark of a bubble: the price feeds on expected price rises instead of on profits.",
            "Essa é a marca de uma bolha: o preço se alimenta da expectativa de alta, e não do lucro.",
          ),
        ),
        bankOption(
          t(
            "The price doubled as the company's profits doubled",
            "O preço dobrou junto com o lucro da empresa",
          ),
          t(
            "A price that rises with profits is growth, not a bubble.",
            "Um preço que sobe junto com o lucro é crescimento, não bolha.",
          ),
          t(
            "Confuses growth backed by profits with a bubble",
            "Confunde crescimento com lucro por trás com bolha",
          ),
        ),
        bankOption(
          t("The stock rose 10% this year", "A ação subiu 10% neste ano"),
          t(
            "A rise alone says nothing. What matters is whether profits explain it.",
            "Uma alta sozinha não diz nada. O que importa é se o lucro a explica.",
          ),
          t("Thinks any rise is a bubble", "Acha que qualquer alta é bolha"),
        ),
      ],
      question: t(
        "Which sign best suggests a stock's rise may be a bubble?",
        "Qual sinal mais indica que a alta de uma ação pode ser uma bolha?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "bubble-sign",
    skill: "bubbles",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks a fall and a rise of the same percent cancel out",
        "Acha que uma queda e uma alta de mesma porcentagem se anulam",
      ),
      reason: t(
        "The rise starts from a smaller base: $50 up 50% is only $75. Getting back to $100 takes a 100% rise.",
        "A alta parte de uma base menor: R$ 50 com alta de 50% dá só R$ 75. Voltar a R$ 100 exige uma alta de 100%.",
      ),
      statement: t(
        "After a crash, a stock that fell 50%, from $100 to $50, only needs to rise 50% to get back to $100.",
        "Depois de uma queda, uma ação que caiu 50%, de R$ 100 para R$ 50, só precisa subir 50% para voltar a R$ 100.",
      ),
    },
    difficulty: 1,
    format: "trueFalse",
    key: "half-fall-needs-double",
    skill: "bubbles",
  },
  {
    content: {
      context: null,
      math: {
        answer: 2158.92,
        commonMistakes: [
          {
            expression: "amount * (1 + rate / 100 * years)",
            misconception: t(
              "Added the same gain every year, as in simple interest",
              "Somou o mesmo ganho todo ano, como nos juros simples",
            ),
            reason: t(
              "Each year's gain also earns, so the money is multiplied every year, not added to.",
              "O ganho de cada ano também rende, então o dinheiro é multiplicado todo ano, e não somado.",
            ),
          },
          {
            expression: "amount * (1 + rate / 100)^years - amount",
            misconception: t(
              "Gave only the gain, without the money invested",
              "Deu só o ganho, sem o dinheiro investido",
            ),
            reason: t(
              "The question asks how much you have, which includes what you put in.",
              "A pergunta é quanto você tem, o que inclui o que você aplicou.",
            ),
          },
        ],
        solution: "amount * (1 + rate / 100)^years",
        steps: [
          {
            expression: "1 + rate / 100",
            text: t(
              "Each year multiplies the money by 1 + {rate}/100 = {result}",
              "Cada ano multiplica o dinheiro por 1 + {rate}/100 = {result}",
            ),
          },
          {
            expression: "amount * (1 + rate / 100)^years",
            text: t(
              "{amount} multiplied by that {years} times: {result}",
              "{amount} multiplicado por isso {years} vezes: {result}",
            ),
          },
        ],
        tolerance: { kind: "relative", value: 0.005 },
        unit: t("$", "R$"),
        variables: [
          { max: 20_000, min: 500, name: "amount", step: 500, unit: t("$", "R$"), value: 1000 },
          { max: 12, min: 2, name: "rate", step: 1, unit: "%", value: 8 },
          { max: 30, min: 2, name: "years", step: 1, unit: null, value: 10 },
        ],
      },
      question: t(
        "You invest {amount} dollars, and it earns {rate}% every year, with every gain reinvested. How much do you have after {years} years, in dollars?",
        "Você investe R$ {amount}, que rendem {rate}% todo ano, com todo ganho reinvestido. Quanto você tem depois de {years} anos, em reais?",
      ),
    },
    difficulty: 0,
    format: "numeric",
    key: "compound-balance",
    skill: "compound-growth",
  },
  {
    content: {
      context: t(
        "At about 10% a year, money doubles roughly every 7 years. You invest $10,000 and leave it for 21 years at that rate.",
        "A cerca de 10% ao ano, o dinheiro dobra mais ou menos a cada 7 anos. Você investe R$ 10.000 e deixa por 21 anos a essa taxa.",
      ),
      options: [
        bankOption(
          t("About $80,000", "Cerca de R$ 80.000"),
          t(
            "21 years is three doublings: $20,000, then $40,000, then $80,000.",
            "21 anos são três dobras: R$ 20.000, depois R$ 40.000, depois R$ 80.000.",
          ),
        ),
        bankOption(
          t("About $40,000", "Cerca de R$ 40.000"),
          t(
            "Each doubling doubles everything you have by then, not just the first $10,000.",
            "Cada dobra dobra tudo o que você tem até ali, não só os primeiros R$ 10.000.",
          ),
          t("Added the starting amount at each doubling", "Somou o valor inicial a cada dobra"),
        ),
        bankOption(
          t("About $30,000", "Cerca de R$ 30.000"),
          t(
            "Three doublings multiply by 2 three times, which is 8 times, not 3.",
            "Três dobras multiplicam por 2 três vezes, ou seja, 8 vezes, não 3.",
          ),
          t("Multiplied by the number of doublings", "Multiplicou pelo número de dobras"),
        ),
        bankOption(
          t("About $60,000", "Cerca de R$ 60.000"),
          t(
            "Doubling once and then counting the other periods in a line misses that each doubling builds on the last.",
            "Dobrar uma vez e contar os outros períodos em linha reta ignora que cada dobra parte da anterior.",
          ),
          t(
            "Treated growth after the first doubling as linear",
            "Tratou o crescimento depois da primeira dobra como linear",
          ),
        ),
      ],
      question: t("Roughly how much will you have?", "Mais ou menos quanto você vai ter?"),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "three-doublings",
    skill: "compound-growth",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks compound growth adds the same amount every year",
        "Acha que juros sobre juros somam o mesmo valor todo ano",
      ),
      reason: t(
        "Each year's gain is a percent of a bigger balance, so later years add much more than the first.",
        "O ganho de cada ano é uma porcentagem de um saldo maior, então os anos seguintes somam bem mais que o primeiro.",
      ),
      statement: t(
        "With compound growth at the same rate, the gain in year 20 is about the same as the gain in year 1.",
        "Com juros sobre juros à mesma taxa, o ganho no ano 20 é mais ou menos igual ao ganho no ano 1.",
      ),
    },
    difficulty: -1,
    format: "trueFalse",
    key: "later-years-gain-more",
    skill: "compound-growth",
  },
  {
    content: {
      context: t(
        "Two friends each invest the same amount once, earning the same 8% a year. One invests at 25, the other at 35. Neither adds more money.",
        "Dois amigos investem a mesma quantia uma única vez, rendendo os mesmos 8% ao ano. Um investe aos 25 anos, o outro aos 35. Nenhum dos dois aplica mais nada.",
      ),
      options: [
        bankOption(
          t(
            "The one who started at 25 has about twice as much",
            "Quem começou aos 25 tem cerca do dobro",
          ),
          t(
            "Ten extra years at 8% multiply the money about 2.2 times, and those are years of growth on an already large balance.",
            "Dez anos a mais a 8% multiplicam o dinheiro cerca de 2,2 vezes, e são anos de crescimento sobre um saldo já grande.",
          ),
        ),
        bankOption(
          t(
            "The one who started at 25 has about a third more, since 40 years is a third more than 30",
            "Quem começou aos 25 tem cerca de um terço a mais, já que 40 anos é um terço a mais que 30",
          ),
          t(
            "Compound money doesn't grow in proportion to time: the extra years multiply the whole balance.",
            "Com juros sobre juros, o dinheiro não cresce em proporção ao tempo: os anos a mais multiplicam o saldo inteiro.",
          ),
          t(
            "Thinks money grows in proportion to the years invested",
            "Acha que o dinheiro cresce em proporção aos anos investidos",
          ),
        ),
        bankOption(
          t(
            "About the same, since they invested the same amount",
            "Mais ou menos o mesmo, já que investiram a mesma quantia",
          ),
          t(
            "The amount was the same, but the time wasn't, and time is what compounding runs on.",
            "A quantia foi a mesma, mas o tempo não, e é do tempo que os juros sobre juros dependem.",
          ),
          t("Ignores how much the extra years add", "Ignora quanto os anos a mais acrescentam"),
        ),
      ],
      question: t(
        "At 65, how do their balances compare?",
        "Aos 65 anos, como os saldos se comparam?",
      ),
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "start-ten-years-earlier",
    skill: "compound-growth",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Shares of 30 companies across banking, energy, retail and health",
            "Ações de 30 empresas de bancos, energia, varejo e saúde",
          ),
          t(
            "Many companies in different businesses: a bad year in one sector doesn't sink the rest.",
            "Muitas empresas de negócios diferentes: um ano ruim num setor não afunda o resto.",
          ),
        ),
        bankOption(
          t("Shares of 10 different banks", "Ações de 10 bancos diferentes"),
          t(
            "Banks tend to rise and fall together, so a crisis in banking hits all ten.",
            "Bancos tendem a subir e cair juntos, então uma crise bancária atinge os dez.",
          ),
          t(
            "Counts companies without asking how different they are",
            "Conta empresas sem ver o quanto elas são diferentes",
          ),
        ),
        bankOption(
          t(
            "All your money in the biggest company in the country",
            "Todo o seu dinheiro na maior empresa do país",
          ),
          t(
            "Even giant companies have bad years or fail. One company is one bet.",
            "Até empresas gigantes têm anos ruins ou quebram. Uma empresa é uma aposta só.",
          ),
          t("Thinks one big company is safe enough", "Acha que uma empresa grande já é segura"),
        ),
        bankOption(
          t(
            "Shares of 2 companies you know very well",
            "Ações de 2 empresas que você conhece muito bem",
          ),
          t(
            "Knowing a company doesn't protect you from its bad luck.",
            "Conhecer uma empresa não te protege do azar dela.",
          ),
          t(
            "Thinks knowing a company replaces spreading risk",
            "Acha que conhecer a empresa substitui espalhar o risco",
          ),
        ),
      ],
      question: t(
        "Which of these portfolios is the most diversified?",
        "Qual destas carteiras é a mais diversificada?",
      ),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "most-diversified",
    skill: "diversification",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks diversification removes all risk",
        "Acha que diversificar elimina todo o risco",
      ),
      reason: t(
        "It protects you from one company's bad luck, but when the whole market falls, a diversified portfolio falls too.",
        "Ela protege do azar de uma empresa, mas quando o mercado inteiro cai, a carteira diversificada cai junto.",
      ),
      statement: t(
        "If you own shares of many different companies, you can't lose money in the stock market.",
        "Se você tem ações de muitas empresas diferentes, não tem como perder dinheiro na bolsa.",
      ),
    },
    difficulty: 0,
    format: "trueFalse",
    key: "diversified-still-falls",
    skill: "diversification",
  },
  {
    content: {
      context: t(
        "You split your money equally among 20 companies. One goes bankrupt and its shares go to zero. The other 19 stay where they were.",
        "Você divide seu dinheiro igualmente entre 20 empresas. Uma vai à falência e as ações dela vão a zero. As outras 19 ficam onde estavam.",
      ),
      options: [
        bankOption(
          t("About one twentieth of it", "Cerca de um vigésimo"),
          t(
            "Each company was a twentieth of your money, and only that slice was lost.",
            "Cada empresa era um vigésimo do seu dinheiro, e só essa fatia se perdeu.",
          ),
        ),
        bankOption(
          t("About a fifth of it", "Cerca de um quinto"),
          t(
            "With twenty equal slices, each company holds one part in twenty of your money.",
            "Com vinte fatias iguais, cada empresa fica com uma parte em vinte do seu dinheiro.",
          ),
          t("Mixed up 20 companies with 20%", "Confundiu 20 empresas com 20%"),
        ),
        bankOption(
          t("Nothing, since the others make up for it", "Nada, já que as outras compensam"),
          t(
            "The others didn't rise, so nothing made up for the lost slice.",
            "As outras não subiram, então nada compensou a fatia perdida.",
          ),
          t("Thinks other holdings cancel a loss", "Acha que as outras ações anulam a perda"),
        ),
      ],
      question: t("How much of your money did you lose?", "Quanto do seu dinheiro você perdeu?"),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "one-of-twenty-fails",
    skill: "diversification",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Retirement savings you won't touch for 25 years",
            "Dinheiro da aposentadoria que você não vai mexer por 25 anos",
          ),
          t(
            "Over decades, stocks have had time to recover from their falls. Money you won't need soon can ride them out.",
            "Em décadas, as ações tiveram tempo de se recuperar das quedas. Um dinheiro que você não vai precisar logo aguenta esperar.",
          ),
        ),
        bankOption(
          t("Your emergency fund", "A sua reserva de emergência"),
          t(
            "Emergencies don't wait for the market to recover. That money must be there when you need it.",
            "Emergências não esperam o mercado se recuperar. Esse dinheiro precisa estar lá quando você precisar.",
          ),
          t(
            "Ignores that stocks can be down when you need the money",
            "Ignora que as ações podem estar em baixa quando você precisar do dinheiro",
          ),
        ),
        bankOption(
          t("Next semester's college tuition", "A mensalidade da faculdade do próximo semestre"),
          t(
            "In a few months, stocks can fall a lot and have no time to come back.",
            "Em poucos meses, as ações podem cair muito e não ter tempo de voltar.",
          ),
          t(
            "Applies long-run gains to money needed soon",
            "Aplica os ganhos de longo prazo a um dinheiro que vai ser usado logo",
          ),
        ),
      ],
      question: t("Which money fits best in stocks?", "Que dinheiro faz mais sentido na bolsa?"),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "money-for-stocks",
    skill: "risk-horizon",
  },
  {
    content: {
      context: t(
        "You'll need $20,000 in 8 months to pay for your wedding. Over decades, stocks have grown more than savings accounts.",
        "Você vai precisar de R$ 20.000 daqui a 8 meses para pagar o casamento. Ao longo de décadas, as ações renderam mais que a poupança.",
      ),
      options: [
        bankOption(
          t(
            "A safe investment you can withdraw anytime, like a high-yield savings account",
            "Um investimento seguro e de resgate fácil, como o Tesouro Selic",
          ),
          t(
            "In 8 months stocks can be well below what you paid, and the wedding date won't move.",
            "Em 8 meses as ações podem estar bem abaixo do que você pagou, e a data do casamento não vai mudar.",
          ),
        ),
        bankOption(
          t("Stocks, since they grow more over time", "Ações, já que rendem mais com o tempo"),
          t(
            "They grow more over decades, not over months. In 8 months they can just as well fall.",
            "Elas rendem mais em décadas, não em meses. Em 8 meses, podem muito bem cair.",
          ),
          t(
            "Applies long-run averages to a short deadline",
            "Aplica médias de longo prazo a um prazo curto",
          ),
        ),
        bankOption(
          t("Shares of one large, stable company", "Ações de uma única empresa grande e estável"),
          t(
            "Even stable companies' shares can drop 20% in a few months, and one company adds its own risk.",
            "Até ações de empresas estáveis podem cair 20% em poucos meses, e uma empresa só traz o próprio risco.",
          ),
          t(
            "Thinks a stable company's shares are safe in the short run",
            "Acha que a ação de uma empresa estável é segura no curto prazo",
          ),
        ),
      ],
      question: t(
        "Where does this money make the most sense?",
        "Onde esse dinheiro faz mais sentido?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "wedding-money",
    skill: "risk-horizon",
  },
  {
    content: {
      context: null,
      isTrue: true,
      misconception: null,
      reason: t(
        "In 2008 the S&P 500 fell about 37%. That's why money you need soon doesn't belong in stocks.",
        "Em 2008, o Ibovespa caiu cerca de 41%. Por isso, dinheiro que você vai usar logo não deve ficar na bolsa.",
      ),
      statement: t(
        "In a single year, a whole stock index can fall more than 30%.",
        "Em um único ano, um índice inteiro de ações pode cair mais de 30%.",
      ),
    },
    difficulty: 1,
    format: "trueFalse",
    key: "index-can-fall-a-third",
    skill: "risk-horizon",
  },
];
