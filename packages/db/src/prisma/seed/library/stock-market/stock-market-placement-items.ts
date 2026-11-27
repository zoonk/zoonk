import { t } from "../../_utils/localize";
import { bankOption } from "../content";
import { type SeedItem } from "../types";

/** Hard-to-guess tap questions, so placement can confirm each skill without writing any. */
export const stockMarketPlacementItems: SeedItem[] = [
  {
    content: {
      pairs: [
        { left: t("Share", "Ação"), right: t("A slice of a company", "Fatia de uma empresa") },
        {
          left: t("Shareholder", "Acionista"),
          right: t("Someone who owns shares", "Quem tem ações"),
        },
        {
          left: t("Stake", "Participação"),
          right: t("How much of it you own", "Quanto dela é seu"),
        },
        {
          left: t("Stock market", "Bolsa"),
          right: t("Where shares are traded", "Onde ações são negociadas"),
        },
      ],
      question: t("Match each word to what it means.", "Ligue cada palavra ao que ela quer dizer."),
      reason: t(
        "A share is a slice of a company, the shareholder owns it, your stake is how big your slice is, and the stock market is where people buy and sell them.",
        "Uma ação é uma fatia da empresa, o acionista é quem tem essa fatia, a participação é o tamanho dela e a Bolsa é onde as pessoas compram e vendem ações.",
      ),
    },
    difficulty: 0,
    format: "matchPairs",
    key: "placement-share-words-match",
    skill: "share-ownership",
  },
  {
    content: {
      question: t(
        "Put these from the smallest piece of the company to the largest.",
        "Coloque do menor pedaço da empresa para o maior.",
      ),
      reason: t(
        "Your piece is your shares divided by all the shares: 1 of a million is tiny, 1 of 2 is half the company.",
        "Seu pedaço é o número das suas ações dividido pelo total: 1 em um milhão é minúsculo, 1 em 2 é metade da empresa.",
      ),
      steps: [
        t("1 of 1 million shares", "1 de 1 milhão de ações"),
        t("1 of 10,000 shares", "1 de 10 mil ações"),
        t("1 of 100 shares", "1 de 100 ações"),
        t("1 of 2 shares", "1 de 2 ações"),
      ],
    },
    difficulty: -1,
    format: "order",
    key: "placement-share-size-order",
    skill: "share-ownership",
  },
  {
    content: {
      context: null,
      fixedOrder: false,
      options: [
        bankOption(
          t("You own a small piece of the company", "Você é dono de um pedaço pequeno da empresa"),
          t(
            "1% of the shares is 1% of the company.",
            "Ter 1% das ações é ser dono de 1% da empresa.",
          ),
        ),
        bankOption(
          t(
            "Your piece is worth more if the company grows",
            "Seu pedaço vale mais se a empresa crescer",
          ),
          t(
            "Your slice grows and shrinks with the whole company's value.",
            "Sua fatia cresce e encolhe junto com o valor da empresa toda.",
          ),
        ),
        bankOption(
          t("You own part of its future profits", "Você tem direito a parte dos lucros futuros"),
          t(
            "Owning a slice means owning that slice of what it earns.",
            "Ser dono de uma fatia é ser dono dessa fatia do que ela ganha.",
          ),
        ),
        bankOption(
          t("You can take 1% of its cash anytime", "Você pode sacar 1% do caixa quando quiser"),
          t(
            "The company's cash isn't yours to withdraw; you can only sell your shares.",
            "O dinheiro da empresa não é seu para sacar; você só pode vender suas ações.",
          ),
          t(
            "Thinks a share lets you take money out of the company",
            "Acha que a ação deixa você tirar dinheiro da empresa",
          ),
        ),
        bankOption(
          t("You help run its daily decisions", "Você ajuda a tomar as decisões do dia a dia"),
          t(
            "Managers run the company day to day; shareholders vote only on big decisions.",
            "Quem toca o dia a dia são os gestores; acionistas votam só nas grandes decisões.",
          ),
          t(
            "Thinks owning shares means managing the company",
            "Acha que ter ações é administrar a empresa",
          ),
        ),
        bankOption(
          t("The company owes you your money back", "A empresa deve devolver seu dinheiro"),
          t(
            "A share isn't a loan: nobody has to pay you back.",
            "Ação não é empréstimo: ninguém é obrigado a devolver seu dinheiro.",
          ),
          t("Confuses a share with a loan", "Confunde ação com empréstimo"),
        ),
      ],
      question: t(
        "You own 1% of a company's shares. Select everything that is true.",
        "Você tem 1% das ações de uma empresa. Marque tudo o que é verdade.",
      ),
      select: "all",
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "placement-share-owner-select",
    skill: "share-ownership",
  },
  {
    content: {
      pairs: [
        {
          left: t("Lenders", "Bancos credores"),
          right: t("Loan plus interest", "Empréstimo com juros"),
        },
        { left: t("Employees", "Funcionários"), right: t("Their wages", "O salário") },
        { left: t("Government", "Governo"), right: t("Taxes", "Impostos") },
        {
          left: t("Shareholders", "Acionistas"),
          right: t("Whatever profit is left", "O lucro que sobrar"),
        },
      ],
      question: t(
        "Match each group to what a company owes it.",
        "Ligue cada grupo ao que a empresa deve a ele.",
      ),
      reason: t(
        "Lenders, workers and the government are owed fixed amounts; shareholders get only what's left, so nothing is promised to them.",
        "Credores, funcionários e governo têm valores combinados a receber; os acionistas ficam só com o que sobra, então nada é prometido a eles.",
      ),
    },
    difficulty: 0,
    format: "matchPairs",
    key: "placement-shareholder-owed-match",
    skill: "shareholder-rights",
  },
  {
    content: {
      question: t(
        "Put these in the order they come out of what a company earns, first to last.",
        "Coloque na ordem em que saem do que a empresa ganha, do primeiro ao último.",
      ),
      reason: t(
        "Costs like wages come first, then interest on loans, then taxes on the profit; shareholders get what remains.",
        "Primeiro vêm custos como salários, depois os juros dos empréstimos e os impostos sobre o lucro; os acionistas ficam com o resto.",
      ),
      steps: [
        t("Wages and suppliers", "Salários e fornecedores"),
        t("Interest on loans", "Juros dos empréstimos"),
        t("Taxes on the profit", "Impostos sobre o lucro"),
        t("What's left, for shareholders", "O que sobra, para os acionistas"),
      ],
    },
    difficulty: 1,
    format: "order",
    key: "placement-shareholder-payout-order",
    skill: "shareholder-rights",
  },
  {
    content: {
      context: null,
      fixedOrder: false,
      options: [
        bankOption(
          t("A share of the profits it pays out", "Parte dos lucros que ela distribui"),
          t(
            "When the company pays out profit, each share gets its part.",
            "Quando a empresa distribui lucro, cada ação recebe sua parte.",
          ),
        ),
        bankOption(
          t("Usually a vote on big decisions", "Em geral, voto nas grandes decisões"),
          t(
            "Common shares vote on things like who sits on the board.",
            "Ações ordinárias votam em coisas como quem fica no conselho.",
          ),
        ),
        bankOption(
          t("A piece of the company's value", "Um pedaço do valor da empresa"),
          t(
            "If the company is worth more, so is every share.",
            "Se a empresa passa a valer mais, cada ação também vale.",
          ),
        ),
        bankOption(
          t("Their money back if the stock falls", "O dinheiro de volta se a ação cair"),
          t("Nobody covers a shareholder's loss.", "Ninguém cobre o prejuízo do acionista."),
          t("Thinks losses are covered", "Acha que alguém cobre o prejuízo"),
        ),
        bankOption(
          t("A say in who gets hired", "Opinião sobre quem é contratado"),
          t(
            "Hiring is a daily decision the managers make.",
            "Contratar é decisão do dia a dia, tomada pelos gestores.",
          ),
          t(
            "Thinks shareholders run the company day to day",
            "Acha que acionistas tocam a empresa no dia a dia",
          ),
        ),
        bankOption(
          t("Payment before the lenders", "Pagamento antes dos credores"),
          t(
            "Lenders are always paid before shareholders.",
            "Credores sempre recebem antes dos acionistas.",
          ),
          t("Thinks owners come before lenders", "Acha que os donos vêm antes dos credores"),
        ),
      ],
      question: t(
        "Select everything a shareholder gets.",
        "Marque tudo o que um acionista recebe.",
      ),
      select: "all",
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "placement-shareholder-gets-select",
    skill: "shareholder-rights",
  },
  {
    content: {
      pairs: [
        { left: t("100 shares, $1 each", "100 ações, R$ 1 cada"), right: t("$100", "R$ 100") },
        { left: t("100 shares, $0.50 each", "100 ações, R$ 0,50 cada"), right: t("$50", "R$ 50") },
        { left: t("10 shares, $2 each", "10 ações, R$ 2 cada"), right: t("$20", "R$ 20") },
        { left: t("50 shares, $0.20 each", "50 ações, R$ 0,20 cada"), right: t("$10", "R$ 10") },
      ],
      question: t(
        "Each share pays the dividend shown. Match each case to what you receive.",
        "Cada ação paga o dividendo indicado. Ligue cada caso ao que você recebe.",
      ),
      reason: t(
        "A dividend is paid per share, so you get the number of shares times the amount per share.",
        "O dividendo é pago por ação, então você recebe o número de ações vezes o valor por ação.",
      ),
    },
    difficulty: 0,
    format: "matchPairs",
    key: "placement-dividend-amount-match",
    skill: "dividends",
  },
  {
    content: {
      question: t("Put these in the order they happen.", "Coloque na ordem em que acontecem."),
      reason: t(
        "A dividend comes out of profit: the company earns it, decides how much to pay, announces the amount per share and then pays it.",
        "O dividendo sai do lucro: a empresa ganha, decide quanto vai distribuir, anuncia o valor por ação e depois paga.",
      ),
      steps: [
        t("The company makes a profit", "A empresa tem lucro"),
        t("It decides how much to pay out", "Ela decide quanto vai distribuir"),
        t("It announces the amount per share", "Ela anuncia o valor por ação"),
        t("Shareholders get the money", "Os acionistas recebem o dinheiro"),
      ],
    },
    difficulty: -1,
    format: "order",
    key: "placement-dividend-steps-order",
    skill: "dividends",
  },
  {
    content: {
      context: null,
      fixedOrder: false,
      options: [
        bankOption(
          t("They come from the company's profit", "Saem do lucro da empresa"),
          t(
            "A dividend is the part of the profit handed to the owners.",
            "O dividendo é a parte do lucro entregue aos donos.",
          ),
        ),
        bankOption(
          t("They're paid for each share you own", "São pagos para cada ação que você tem"),
          t("More shares means a bigger dividend.", "Mais ações significam mais dividendos."),
        ),
        bankOption(
          t("A company can pay less in a bad year", "A empresa pode pagar menos num ano ruim"),
          t(
            "Less profit usually means less to pay out.",
            "Menos lucro costuma significar menos para distribuir.",
          ),
        ),
        bankOption(
          t("They're paid by the stock exchange", "Quem paga é a Bolsa"),
          t(
            "The company pays them; the exchange only hosts the trading.",
            "Quem paga é a empresa; a Bolsa só organiza a compra e venda.",
          ),
          t("Thinks the exchange pays dividends", "Acha que a Bolsa paga os dividendos"),
        ),
        bankOption(
          t(
            "Everyone gets the same, whatever they own",
            "Todos recebem igual, tenham quantas ações tiverem",
          ),
          t(
            "Dividends are per share, so bigger owners get more.",
            "Dividendos são por ação, então quem tem mais recebe mais.",
          ),
          t(
            "Thinks dividends are a flat amount",
            "Acha que o dividendo é um valor fixo por pessoa",
          ),
        ),
        bankOption(
          t("They're a loan the company pays back", "São um empréstimo que a empresa devolve"),
          t(
            "Nothing is paid back: it's your part of the profit.",
            "Nada é devolvido: é a sua parte do lucro.",
          ),
          t(
            "Confuses dividends with loan repayments",
            "Confunde dividendo com devolução de empréstimo",
          ),
        ),
      ],
      question: t(
        "Select everything that is true about dividends.",
        "Marque tudo o que é verdade sobre dividendos.",
      ),
      select: "all",
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "placement-dividend-facts-select",
    skill: "dividends",
  },
  {
    content: {
      pairs: [
        {
          left: t("Bid", "Oferta de compra"),
          right: t("Most a buyer will pay", "Máximo que alguém paga"),
        },
        {
          left: t("Ask", "Oferta de venda"),
          right: t("Least a seller will take", "Mínimo que alguém aceita"),
        },
        {
          left: t("Spread", "Spread"),
          right: t("Gap between bid and ask", "Diferença entre as duas"),
        },
        {
          left: t("Trade", "Negócio"),
          right: t("One side takes a price", "Um lado aceita o preço"),
        },
      ],
      question: t(
        "Match each order book word to what it means.",
        "Ligue cada termo do livro de ofertas ao que ele quer dizer.",
      ),
      reason: t(
        "Buyers post bids, sellers post asks, the spread is the gap between the best of each, and a trade happens when one side accepts the other's price.",
        "Compradores anunciam ofertas de compra, vendedores anunciam ofertas de venda, o spread é a diferença entre as melhores de cada lado e o negócio sai quando um lado aceita o preço do outro.",
      ),
    },
    difficulty: 0,
    format: "matchPairs",
    key: "placement-order-book-words-match",
    skill: "order-book",
  },
  {
    content: {
      question: t(
        "Put these in the order a trade happens.",
        "Coloque na ordem em que um negócio acontece.",
      ),
      reason: t(
        "Offers come first, the best of each side shows on top, a trade needs one side to accept, and only then do shares and money change hands.",
        "Primeiro vêm as ofertas, as melhores de cada lado aparecem no topo, o negócio precisa que um lado aceite e só então ações e dinheiro trocam de mãos.",
      ),
      steps: [
        t("Buyers and sellers post offers", "Compradores e vendedores fazem ofertas"),
        t("The best bid and ask show on top", "As melhores ofertas aparecem no topo"),
        t("One side accepts the other's price", "Um lado aceita o preço do outro"),
        t("Shares and money change hands", "Ações e dinheiro trocam de mãos"),
      ],
    },
    difficulty: -1,
    format: "order",
    key: "placement-order-book-trade-order",
    skill: "order-book",
  },
  {
    content: {
      context: null,
      fixedOrder: false,
      options: [
        bankOption(
          t("Buying right now costs $20.12", "Comprar agora custa R$ 20,12"),
          t(
            "To buy now you accept the lowest ask.",
            "Para comprar agora você aceita a menor oferta de venda.",
          ),
        ),
        bankOption(
          t("Someone wants to buy at $20.10", "Alguém quer comprar a R$ 20,10"),
          t("That's what the best bid says.", "É o que a melhor oferta de compra diz."),
        ),
        bankOption(
          t("No trade happens until a side accepts", "Nada é negociado até um lado aceitar"),
          t(
            "While bid and ask differ, the two sides are just waiting.",
            "Enquanto as ofertas são diferentes, os dois lados só esperam.",
          ),
        ),
        bankOption(
          t("Buying right now costs $20.10", "Comprar agora custa R$ 20,10"),
          t(
            "$20.10 is what a buyer offers; a seller wants $20.12.",
            "R$ 20,10 é o que um comprador oferece; o vendedor quer R$ 20,12.",
          ),
          t("Thinks you buy at the bid", "Acha que se compra pela oferta de compra"),
        ),
        bankOption(
          t("The exchange sets both prices", "A Bolsa define os dois preços"),
          t(
            "Buyers and sellers post them; the exchange only matches them.",
            "Compradores e vendedores definem; a Bolsa só junta as ofertas.",
          ),
          t("Thinks the exchange sets prices", "Acha que a Bolsa define os preços"),
        ),
        bankOption(
          t("A seller must accept $20.10", "O vendedor é obrigado a aceitar R$ 20,10"),
          t("Nobody has to accept an offer.", "Ninguém é obrigado a aceitar uma oferta."),
          t("Thinks sellers must take the bid", "Acha que o vendedor tem que aceitar a oferta"),
        ),
      ],
      question: t(
        "Best bid $20.10, best ask $20.12. Select everything that is true.",
        "Melhor compra R$ 20,10, melhor venda R$ 20,12. Marque tudo o que é verdade.",
      ),
      select: "all",
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "placement-order-book-quote-select",
    skill: "order-book",
  },
  {
    content: {
      pairs: [
        { left: t("Next trade at $11", "Próximo negócio a R$ 11"), right: t("$11", "R$ 11") },
        { left: t("Next trade at $9", "Próximo negócio a R$ 9"), right: t("$9", "R$ 9") },
        {
          left: t("A $12 bid, no trade", "Oferta de R$ 12, sem negócio"),
          right: t("$10", "R$ 10"),
        },
        {
          left: t("Trades at $11, then $10.50", "Negócios a R$ 11 e R$ 10,50"),
          right: t("$10.50", "R$ 10,50"),
        },
      ],
      question: t(
        "The last trade was at $10. Match each next event to the price the screen shows.",
        "O último negócio foi a R$ 10. Ligue cada acontecimento ao preço que a tela mostra.",
      ),
      reason: t(
        "The screen shows the last trade: a bid nobody accepted changes nothing, and after two trades the latest one counts.",
        "A tela mostra o último negócio: uma oferta que ninguém aceitou não muda nada e, depois de dois negócios, vale o mais recente.",
      ),
    },
    difficulty: 0,
    format: "matchPairs",
    key: "placement-last-trade-screen-match",
    skill: "price-last-trade",
  },
  {
    content: {
      question: t(
        "Put these in the order they happen when a stock's price changes.",
        "Coloque na ordem em que acontecem quando o preço de uma ação muda.",
      ),
      reason: t(
        "The price moves only after a trade: someone offers a new price, the other side accepts, they trade, and the screen shows it.",
        "O preço só muda depois de um negócio: alguém oferece um novo preço, o outro lado aceita, eles negociam e a tela mostra.",
      ),
      steps: [
        t("A buyer offers more", "Um comprador oferece mais"),
        t("A seller accepts that price", "Um vendedor aceita esse preço"),
        t("The trade goes through", "O negócio é fechado"),
        t("The screen shows the new price", "A tela mostra o novo preço"),
      ],
    },
    difficulty: -1,
    format: "order",
    key: "placement-last-trade-steps-order",
    skill: "price-last-trade",
  },
  {
    content: {
      context: null,
      fixedOrder: false,
      options: [
        bankOption(
          t("The last trade was at $11", "O último negócio foi a R$ 11"),
          t("The price on screen is the last trade.", "O preço na tela é o do último negócio."),
        ),
        bankOption(
          t("A buyer agreed to pay $11", "Um comprador topou pagar R$ 11"),
          t("Every trade has a buyer at that price.", "Todo negócio tem um comprador nesse preço."),
        ),
        bankOption(
          t("A seller accepted $11", "Um vendedor aceitou R$ 11"),
          t("Every trade has a seller at that price.", "Todo negócio tem um vendedor nesse preço."),
        ),
        bankOption(
          t("The company set the new price", "A empresa definiu o novo preço"),
          t(
            "Companies don't set their stock's price; trades do.",
            "A empresa não define o preço da ação; os negócios definem.",
          ),
          t("Thinks the company sets the price", "Acha que a empresa define o preço"),
        ),
        bankOption(
          t("Every owner sold at $11", "Todos os donos venderam a R$ 11"),
          t(
            "One trade is enough to change the price on screen.",
            "Basta um negócio para mudar o preço na tela.",
          ),
          t(
            "Thinks the price is what every share traded at",
            "Acha que o preço é o de todas as ações negociadas",
          ),
        ),
      ],
      question: t(
        "A stock's price on screen went from $10 to $11. Select everything that is true.",
        "O preço de uma ação na tela foi de R$ 10 para R$ 11. Marque tudo o que é verdade.",
      ),
      select: "all",
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "placement-last-trade-jump-select",
    skill: "price-last-trade",
  },
  {
    content: {
      pairs: [
        { left: t("Index", "Índice"), right: t("A basket of stocks", "Uma cesta de ações") },
        { left: t("Points", "Pontos"), right: t("The index's level", "O nível do índice") },
        {
          left: t("Up 1% today", "Subiu 1% hoje"),
          right: t("Basket worth 1% more", "A cesta vale 1% a mais"),
        },
        {
          left: t("S&P 500", "Ibovespa"),
          right: t("500 big US companies", "Principal índice do Brasil"),
        },
      ],
      question: t("Match each term to what it means.", "Ligue cada termo ao que ele quer dizer."),
      reason: t(
        "An index follows a basket of stocks, its points show its level, a 1% rise means the basket is worth 1% more, and the S&P 500 tracks 500 big US companies.",
        "Um índice acompanha uma cesta de ações, os pontos mostram o nível dele, subir 1% quer dizer que a cesta vale 1% a mais e o Ibovespa é o principal índice da Bolsa brasileira.",
      ),
    },
    difficulty: 0,
    format: "matchPairs",
    key: "placement-index-terms-match",
    skill: "indexes",
  },
  {
    content: {
      question: t(
        "Put these in the order an index's number for the day is worked out.",
        "Coloque na ordem em que o número do índice no dia é calculado.",
      ),
      reason: t(
        "First the basket is chosen, then each stock's price is tracked, the prices are combined by each company's weight, and the total is compared with yesterday's close.",
        "Primeiro se escolhe a cesta, depois se acompanha o preço de cada ação, os preços são combinados pelo peso de cada empresa e o total é comparado com o fechamento de ontem.",
      ),
      steps: [
        t("Pick the stocks in the basket", "Escolher as ações da cesta"),
        t("Track each stock's price", "Acompanhar o preço de cada ação"),
        t("Combine them by each one's weight", "Somar pelo peso de cada uma"),
        t("Compare with yesterday's close", "Comparar com o fechamento de ontem"),
      ],
    },
    difficulty: 1,
    format: "order",
    key: "placement-index-calculation-order",
    skill: "indexes",
  },
  {
    content: {
      context: null,
      fixedOrder: false,
      options: [
        bankOption(
          t("How a group of stocks moved", "Como um grupo de ações se mexeu"),
          t("That's exactly what an index tracks.", "É exatamente o que um índice acompanha."),
        ),
        bankOption(
          t("Whether the market rose or fell today", "Se o mercado subiu ou caiu hoje"),
          t(
            "Comparing with yesterday's close shows the day's move.",
            "Comparar com o fechamento de ontem mostra o movimento do dia.",
          ),
        ),
        bankOption(
          t("How the market did over a year", "Como o mercado foi ao longo de um ano"),
          t(
            "Compare its level now with a year ago.",
            "Basta comparar o nível de agora com o de um ano atrás.",
          ),
        ),
        bankOption(
          t("Which single stock to buy", "Qual ação comprar"),
          t(
            "An index shows the basket as a whole, not which stock is best.",
            "O índice mostra a cesta toda, não qual ação é a melhor.",
          ),
          t("Thinks an index recommends stocks", "Acha que o índice recomenda ações"),
        ),
        bankOption(
          t("What your own shares are worth", "Quanto valem as suas ações"),
          t(
            "Your shares can move very differently from the basket.",
            "Suas ações podem se mexer bem diferente da cesta.",
          ),
          t("Thinks the index is your own portfolio", "Acha que o índice é a sua carteira"),
        ),
        bankOption(
          t("How much a stock will pay out", "Quanto uma ação vai pagar de dividendos"),
          t(
            "Dividends come from each company, not from the index.",
            "Dividendos vêm de cada empresa, não do índice.",
          ),
          t("Thinks an index shows dividends", "Acha que o índice mostra dividendos"),
        ),
      ],
      question: t(
        "Select everything a stock index can tell you.",
        "Marque tudo o que um índice de ações pode dizer.",
      ),
      select: "all",
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "placement-index-tells-select",
    skill: "indexes",
  },
  {
    content: {
      pairs: [
        {
          left: t("Expectation", "Expectativa"),
          right: t("What investors think will happen", "O que se acha que vai acontecer"),
        },
        {
          left: t("Surprise", "Surpresa"),
          right: t("A result off the forecast", "Resultado fora do previsto"),
        },
        {
          left: t("Priced in", "Já está no preço"),
          right: t("Already in today's price", "Já conta no valor de hoje"),
        },
        {
          left: t("Reaction", "Reação"),
          right: t("How the price moves on news", "Como o preço reage à notícia"),
        },
      ],
      question: t("Match each term to what it means.", "Ligue cada termo ao que ele quer dizer."),
      reason: t(
        "Prices follow expectations: news already expected is priced in, a surprise is a result off the forecast, and the reaction is how the price moves when news comes out.",
        "Os preços seguem as expectativas: a notícia esperada já está no preço, a surpresa é um resultado fora do previsto e a reação é como o preço se mexe quando a notícia sai.",
      ),
    },
    difficulty: 1,
    format: "matchPairs",
    key: "placement-expectations-terms-match",
    skill: "expectations",
  },
  {
    content: {
      question: t(
        "Everyone expects a profit of $100 million. Put these results from the biggest price rise to the biggest fall.",
        "Todo mundo espera um lucro de R$ 100 milhões. Coloque os resultados da maior alta do preço para a maior queda.",
      ),
      reason: t(
        "The price reacts to the surprise, not the size of the profit: the further above $100 million, the bigger the rise, and a miss makes it fall.",
        "O preço reage à surpresa, não ao tamanho do lucro: quanto mais acima de R$ 100 milhões, maior a alta, e um resultado abaixo faz cair.",
      ),
      steps: [
        t("Profit of $130 million", "Lucro de R$ 130 milhões"),
        t("Profit of $110 million", "Lucro de R$ 110 milhões"),
        t("Profit of $100 million", "Lucro de R$ 100 milhões"),
        t("Profit of $70 million", "Lucro de R$ 70 milhões"),
      ],
    },
    difficulty: 0,
    format: "order",
    key: "placement-expectations-surprise-order",
    skill: "expectations",
  },
  {
    content: {
      context: null,
      fixedOrder: false,
      options: [
        bankOption(
          t(
            "News that changes what investors expect",
            "Notícia que muda o que os investidores esperam",
          ),
          t("A change in expectations moves the price.", "Mudança na expectativa mexe no preço."),
        ),
        bankOption(
          t("A new forecast for next year's profit", "Nova projeção para o lucro do ano que vem"),
          t(
            "Prices look ahead, so a new forecast counts right away.",
            "O preço olha para a frente, então uma nova projeção conta na hora.",
          ),
        ),
        bankOption(
          t("A surprise in today's results", "Uma surpresa no resultado de hoje"),
          t(
            "A result nobody expected changes what the company seems worth.",
            "Um resultado que ninguém esperava muda quanto a empresa parece valer.",
          ),
        ),
        bankOption(
          t("Results everyone knew were coming", "Resultado que todo mundo já esperava"),
          t(
            "What everyone expected is already in the price.",
            "O que todos já esperavam já está no preço.",
          ),
          t("Thinks any good news lifts the price", "Acha que toda notícia boa sobe o preço"),
        ),
        bankOption(
          t("Last year's profit, reported long ago", "O lucro do ano passado, divulgado há tempos"),
          t("Old news was priced in long ago.", "Notícia velha entrou no preço há muito tempo."),
          t(
            "Thinks old results still move prices",
            "Acha que resultado antigo ainda mexe no preço",
          ),
        ),
      ],
      question: t(
        "Select everything that can move a stock's price today.",
        "Marque tudo o que pode mexer no preço de uma ação hoje.",
      ),
      select: "all",
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "placement-expectations-movers-select",
    skill: "expectations",
  },
  {
    content: {
      question: t(
        "Put the stages of a bubble in order.",
        "Coloque as etapas de uma bolha em ordem.",
      ),
      reason: t(
        "A bubble often starts with real growth, then people buy just because prices rise, prices pass what profits justify, and when buyers run out the price collapses.",
        "Uma bolha costuma começar com crescimento de verdade, depois as pessoas compram só porque o preço sobe, o preço passa do que o lucro justifica e, quando faltam compradores, ele desaba.",
      ),
      steps: [
        t("Prices rise with real profits", "Preços sobem com lucros reais"),
        t("People buy because prices rise", "Pessoas compram porque está subindo"),
        t("Prices pass what profits justify", "Preços passam do que o lucro justifica"),
        t("Buyers run out and prices crash", "Faltam compradores e o preço despenca"),
      ],
    },
    difficulty: 0,
    format: "order",
    key: "placement-bubble-stages-order",
    skill: "bubbles",
  },
  {
    content: {
      pairs: [
        {
          left: t("Bubble", "Bolha"),
          right: t("Price far above profits", "Preço muito acima do lucro"),
        },
        { left: t("Crash", "Crash"), right: t("A fast, deep fall", "Queda rápida e funda") },
        {
          left: t("Fear of missing out", "Medo de ficar de fora"),
          right: t("Buying since others do", "Comprar porque outros compram"),
        },
        {
          left: t("Correction", "Correção"),
          right: t("A smaller, slower drop", "Queda menor e mais lenta"),
        },
      ],
      question: t("Match each term to what it means.", "Ligue cada termo ao que ele quer dizer."),
      reason: t(
        "Fear of missing out pushes prices into a bubble, far above profits; a crash is a fast, deep fall, and a correction a milder one.",
        "O medo de ficar de fora empurra os preços para uma bolha, muito acima do lucro; o crash é uma queda rápida e funda, e a correção, uma mais branda.",
      ),
    },
    difficulty: 1,
    format: "matchPairs",
    key: "placement-bubble-terms-match",
    skill: "bubbles",
  },
  {
    content: {
      context: null,
      fixedOrder: false,
      options: [
        bankOption(
          t("Many late buyers lost money", "Muita gente que comprou tarde perdeu dinheiro"),
          t(
            "Whoever bought near the top paid far more than it ended up worth.",
            "Quem comprou perto do topo pagou bem mais do que acabou valendo.",
          ),
        ),
        bankOption(
          t("The price had run far past profits", "O preço tinha passado muito do lucro"),
          t(
            "A rise on hype, not profits, is what makes a bubble.",
            "Uma alta por euforia, e não por lucro, é o que forma a bolha.",
          ),
        ),
        bankOption(
          t(
            "Buyers expected prices to keep rising",
            "Os compradores esperavam que continuasse subindo",
          ),
          t(
            "In a bubble people buy because they think someone will pay more.",
            "Na bolha as pessoas compram porque acham que alguém vai pagar mais.",
          ),
        ),
        bankOption(
          t("It will surely climb back to $100", "Com certeza vai voltar a R$ 100"),
          t(
            "Nothing guarantees a price returns to a bubble's top.",
            "Nada garante que o preço volte ao topo da bolha.",
          ),
          t("Thinks a crash always reverses", "Acha que toda queda se desfaz"),
        ),
        bankOption(
          t("Its profits must have grown tenfold", "O lucro deve ter crescido dez vezes"),
          t(
            "It rose on hype; profits didn't keep up.",
            "Subiu por euforia; o lucro não acompanhou.",
          ),
          t("Thinks every rise is backed by profits", "Acha que toda alta vem do lucro"),
        ),
      ],
      question: t(
        "A stock went from $10 to $100 on hype, then crashed. Select everything that is likely true.",
        "Uma ação foi de R$ 10 para R$ 100 por euforia e depois despencou. Marque tudo o que provavelmente é verdade.",
      ),
      select: "all",
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "placement-bubble-crash-select",
    skill: "bubbles",
  },
  {
    content: {
      pairs: [
        { left: t("1 year", "1 ano"), right: t("$1,100", "R$ 1.100") },
        { left: t("2 years", "2 anos"), right: t("$1,210", "R$ 1.210") },
        { left: t("7 years", "7 anos"), right: t("About $2,000", "Cerca de R$ 2.000") },
        { left: t("14 years", "14 anos"), right: t("About $3,800", "Cerca de R$ 3.800") },
      ],
      question: t(
        "$1,000 grows 10% a year. Match each time to about what it becomes.",
        "R$ 1.000 rendem 10% ao ano. Ligue cada prazo ao valor aproximado.",
      ),
      reason: t(
        "Each year adds 10% of the new total: $1,100, then $1,210, and the money roughly doubles every 7 years.",
        "Cada ano soma 10% do novo total: R$ 1.100, depois R$ 1.210, e o dinheiro quase dobra a cada 7 anos.",
      ),
    },
    difficulty: 0,
    format: "matchPairs",
    key: "placement-compound-years-match",
    skill: "compound-growth",
  },
  {
    content: {
      question: t(
        "Put these in the order compound growth works.",
        "Coloque na ordem em que os juros sobre juros funcionam.",
      ),
      reason: t(
        "The return is added to what you have, so the next return is earned on a bigger total.",
        "O rendimento entra no que você já tem, então o próximo rendimento é sobre um total maior.",
      ),
      steps: [
        t("You invest money", "Você investe um dinheiro"),
        t("It earns a return", "Ele rende"),
        t("The return is added to it", "O rendimento se soma a ele"),
        t("Next year earns on the bigger total", "No ano seguinte rende sobre o total maior"),
      ],
    },
    difficulty: -1,
    format: "order",
    key: "placement-compound-steps-order",
    skill: "compound-growth",
  },
  {
    content: {
      context: null,
      fixedOrder: false,
      options: [
        bankOption(
          t("Money doubles in about 7 years", "O dinheiro dobra em cerca de 7 anos"),
          t(
            "At 10% a year, 1.1 seven times is about 2.",
            "A 10% ao ano, 1,1 sete vezes dá cerca de 2.",
          ),
        ),
        bankOption(
          t("The gains themselves earn gains", "O próprio rendimento também rende"),
          t("That's what makes it compound.", "É isso que faz os juros serem compostos."),
        ),
        bankOption(
          t("Starting earlier ends with more", "Quem começa antes termina com mais"),
          t(
            "More years give the gains more time to grow.",
            "Mais anos dão mais tempo para o rendimento crescer.",
          ),
        ),
        bankOption(
          t("$1,000 earns the same $100 every year", "R$ 1.000 rendem os mesmos R$ 100 todo ano"),
          t(
            "Each year's 10% is on a bigger total, so it earns more than $100.",
            "Os 10% de cada ano são sobre um total maior, então rendem mais de R$ 100.",
          ),
          t("Confuses compound with simple interest", "Confunde juros compostos com simples"),
        ),
        bankOption(
          t("Doubling takes 10 years", "Para dobrar leva 10 anos"),
          t(
            "Gains on gains make it double in about 7.",
            "Rendimento sobre rendimento faz dobrar em cerca de 7.",
          ),
          t("Multiplies 10% by 10 years", "Multiplica 10% por 10 anos"),
        ),
      ],
      question: t(
        "Money grows 10% a year, with every gain kept invested. Select everything that is true.",
        "Um dinheiro rende 10% ao ano, sempre reinvestindo o que rende. Marque tudo o que é verdade.",
      ),
      select: "all",
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "placement-compound-facts-select",
    skill: "compound-growth",
  },
  {
    content: {
      pairs: [
        {
          left: t("All in 1 company", "Tudo em 1 empresa"),
          right: t("Lose everything", "Perde tudo"),
        },
        { left: t("Split across 2", "Dividido em 2"), right: t("Lose half", "Perde metade") },
        {
          left: t("Split across 10", "Dividido em 10"),
          right: t("Lose a tenth", "Perde um décimo"),
        },
        { left: t("Split across 100", "Dividido em 100"), right: t("Lose 1%", "Perde 1%") },
      ],
      question: t(
        "You split your money equally across companies, and one of them goes bankrupt. Match each split to what you lose.",
        "Você divide seu dinheiro igualmente entre empresas e uma delas quebra. Ligue cada divisão ao que você perde.",
      ),
      reason: t(
        "Losing one company costs you only the part you put in it, so the more companies, the smaller the hit.",
        "Perder uma empresa só custa a parte que você colocou nela, então quanto mais empresas, menor o estrago.",
      ),
    },
    difficulty: 0,
    format: "matchPairs",
    key: "placement-diversification-loss-match",
    skill: "diversification",
  },
  {
    content: {
      question: t(
        "Put these steps of spreading your money out in order.",
        "Coloque em ordem as etapas para espalhar seu dinheiro.",
      ),
      reason: t(
        "You choose different kinds of business, decide how much goes into each, buy them, then check the mix from time to time.",
        "Você escolhe tipos diferentes de negócio, decide quanto vai para cada um, compra e depois confere a mistura de tempos em tempos.",
      ),
      steps: [
        t("Pick different kinds of business", "Escolher tipos diferentes de negócio"),
        t("Decide how much goes into each", "Decidir quanto vai para cada um"),
        t("Buy shares of each", "Comprar ações de cada um"),
        t("Check the mix now and then", "Conferir a mistura de vez em quando"),
      ],
    },
    difficulty: -1,
    format: "order",
    key: "placement-diversification-steps-order",
    skill: "diversification",
  },
  {
    content: {
      context: null,
      fixedOrder: false,
      options: [
        bankOption(
          t("One bad company can't sink everything", "Uma empresa ruim não afunda tudo"),
          t(
            "Each company is only a small part of your money.",
            "Cada empresa é só uma parte pequena do seu dinheiro.",
          ),
        ),
        bankOption(
          t(
            "Your total swings less than one stock does",
            "O total oscila menos que uma ação sozinha",
          ),
          t(
            "One company's drop is offset by others that hold up.",
            "A queda de uma é compensada pelas que se seguram.",
          ),
        ),
        bankOption(
          t(
            "It spreads money across different businesses",
            "Espalha o dinheiro por negócios diferentes",
          ),
          t("That's what diversifying means.", "É isso que diversificar quer dizer."),
        ),
        bankOption(
          t("It protects you when the whole market falls", "Protege quando a Bolsa inteira cai"),
          t(
            "When almost every stock falls, a spread-out portfolio falls too.",
            "Quando quase todas as ações caem, a carteira diversificada cai junto.",
          ),
          t(
            "Thinks diversifying removes market risk",
            "Acha que diversificar tira o risco da Bolsa",
          ),
        ),
        bankOption(
          t(
            "It means buying more of your best stock",
            "Quer dizer comprar mais da sua melhor ação",
          ),
          t(
            "Piling into one stock is the opposite of diversifying.",
            "Concentrar em uma ação é o contrário de diversificar.",
          ),
          t("Confuses diversifying with concentrating", "Confunde diversificar com concentrar"),
        ),
      ],
      question: t(
        "Select everything diversification does.",
        "Marque tudo o que a diversificação faz.",
      ),
      select: "all",
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "placement-diversification-does-select",
    skill: "diversification",
  },
  {
    content: {
      pairs: [
        {
          left: t("Need it in 3 months", "Usar em 3 meses"),
          right: t("No stocks", "Nada em ações"),
        },
        {
          left: t("Need it in 2 years", "Usar em 2 anos"),
          right: t("Mostly safe, a few stocks", "Quase tudo seguro, poucas ações"),
        },
        {
          left: t("Need it in 10 years", "Usar em 10 anos"),
          right: t("About half in stocks", "Metade em ações"),
        },
        {
          left: t("Need it in 30 years", "Usar em 30 anos"),
          right: t("Mostly stocks", "Quase tudo em ações"),
        },
      ],
      question: t(
        "Match each time until you need the money to the mix that fits it best.",
        "Ligue cada prazo até usar o dinheiro à mistura que combina melhor.",
      ),
      reason: t(
        "Stocks can fall a lot in a year but have tended to grow over decades, so the longer until you need the money, the more of it can go into stocks.",
        "Ações podem cair muito em um ano, mas costumam crescer em décadas, então quanto mais tempo até usar o dinheiro, mais dele pode ir para ações.",
      ),
    },
    difficulty: 0,
    format: "matchPairs",
    key: "placement-horizon-mix-match",
    skill: "risk-horizon",
  },
  {
    content: {
      question: t(
        "Put these goals from the best fit for stocks to the worst.",
        "Coloque estes objetivos do que mais combina com ações para o que menos combina.",
      ),
      reason: t(
        "The further away a goal is, the more time stocks have to recover from a bad year.",
        "Quanto mais distante o objetivo, mais tempo as ações têm para se recuperar de um ano ruim.",
      ),
      steps: [
        t("Retiring in 30 years", "Aposentadoria em 30 anos"),
        t("A child's college in 15 years", "Faculdade do filho em 15 anos"),
        t("A house down payment in 3 years", "Entrada da casa em 3 anos"),
        t("A trip next month", "Viagem no mês que vem"),
      ],
    },
    difficulty: -1,
    format: "order",
    key: "placement-horizon-goals-order",
    skill: "risk-horizon",
  },
  {
    content: {
      context: null,
      fixedOrder: false,
      options: [
        bankOption(
          t("Over decades they have tended to grow", "Em décadas elas costumam crescer"),
          t(
            "Over long periods, the market has usually ended higher.",
            "Em períodos longos, a Bolsa costuma terminar mais alta.",
          ),
        ),
        bankOption(
          t(
            "Money you need soon is safer elsewhere",
            "Dinheiro para logo fica melhor em outro lugar",
          ),
          t(
            "A bad year right before you need it can't be waited out.",
            "Não dá para esperar passar um ano ruim logo antes de precisar.",
          ),
        ),
        bankOption(
          t("Selling in a bad year locks in the loss", "Vender num ano ruim torna a perda real"),
          t(
            "A drop is only a loss on paper until you sell.",
            "A queda só vira perda de verdade quando você vende.",
          ),
        ),
        bankOption(
          t("They grow a little every single year", "Elas crescem um pouco todo ano"),
          t("Stocks can fall a lot in any one year.", "Ações podem cair muito em qualquer ano."),
          t("Thinks stocks rise steadily", "Acha que ações sobem sem parar"),
        ),
        bankOption(
          t("Short-term money earns most in stocks", "Dinheiro de curto prazo rende mais em ações"),
          t(
            "In a short time stocks may well be down when you need the money.",
            "Em pouco tempo as ações podem estar em baixa justo quando você precisar.",
          ),
          t("Ignores how much stocks swing", "Ignora o quanto as ações oscilam"),
        ),
      ],
      question: t(
        "Select everything that is true about stocks and time.",
        "Marque tudo o que é verdade sobre ações e prazo.",
      ),
      select: "all",
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "placement-horizon-facts-select",
    skill: "risk-horizon",
  },
  {
    content: {
      question: t(
        "Put these in the order a company first sells its shares to the public.",
        "Coloque na ordem em que uma empresa vende suas ações ao público pela primeira vez.",
      ),
      reason: t(
        "A company needs money, decides to sell new shares, investors buy them, and only then do they trade on the exchange.",
        "A empresa precisa de dinheiro, decide vender ações novas, investidores compram e só então elas passam a ser negociadas na Bolsa.",
      ),
      steps: [
        t("The company needs money to grow", "A empresa precisa de dinheiro para crescer"),
        t("It decides to sell new shares", "Ela decide vender ações novas"),
        t("Investors buy the new shares", "Investidores compram as ações novas"),
        t("The shares start trading", "As ações passam a ser negociadas"),
      ],
    },
    difficulty: 0,
    format: "order",
    key: "placement-ipo-steps-order",
    skill: "ipo",
  },
  {
    content: {
      pairs: [
        { left: t("IPO", "IPO"), right: t("First sale of shares", "Primeira venda de ações") },
        {
          left: t("Investor", "Investidor"),
          right: t("Who buys the shares", "Quem compra as ações"),
        },
        {
          left: t("New shares", "Ações novas"),
          right: t("Slices sold for cash", "Fatias vendidas por dinheiro"),
        },
        {
          left: t("Raising money", "Captar recursos"),
          right: t("Getting cash to grow", "Dinheiro para crescer"),
        },
      ],
      question: t("Match each term to what it means.", "Ligue cada termo ao que ele quer dizer."),
      reason: t(
        "In an IPO a company sells new shares for the first time, investors buy those slices, and the cash raised pays for its growth.",
        "No IPO a empresa vende ações novas pela primeira vez, investidores compram essas fatias e o dinheiro captado paga o crescimento dela.",
      ),
    },
    difficulty: -1,
    format: "matchPairs",
    key: "placement-ipo-terms-match",
    skill: "ipo",
  },
  {
    content: {
      context: null,
      fixedOrder: false,
      options: [
        bankOption(
          t(
            "It gets money with no loan to repay",
            "Ela consegue dinheiro sem empréstimo para pagar",
          ),
          t(
            "Selling shares isn't borrowing: nothing has to be paid back.",
            "Vender ações não é pegar emprestado: nada precisa ser devolvido.",
          ),
        ),
        bankOption(
          t(
            "The old owners now share profits with the new ones",
            "Os donos antigos passam a dividir o lucro com os novos",
          ),
          t(
            "The new shareholders own part of the company, so part of its profit.",
            "Os novos acionistas são donos de parte da empresa e, portanto, de parte do lucro.",
          ),
        ),
        bankOption(
          t(
            "New owners can later sell to others",
            "Os novos donos podem vender depois para outros",
          ),
          t(
            "After the first sale, the shares trade between investors.",
            "Depois da primeira venda, as ações são negociadas entre investidores.",
          ),
        ),
        bankOption(
          t("It must pay the buyers back later", "Ela tem que devolver o dinheiro aos compradores"),
          t("Buyers became owners, not lenders.", "Os compradores viraram donos, não credores."),
          t("Confuses selling shares with borrowing", "Confunde vender ações com pegar empréstimo"),
        ),
        bankOption(
          t("Each old owner now owns a bigger slice", "Cada dono antigo fica com uma fatia maior"),
          t(
            "With more shares out there, each old owner's slice gets smaller.",
            "Com mais ações no mercado, a fatia de cada dono antigo diminui.",
          ),
          t(
            "Thinks new shares grow the old stakes",
            "Acha que ações novas aumentam as fatias antigas",
          ),
        ),
      ],
      question: t(
        "A company sells new shares to the public. Select everything that is true.",
        "Uma empresa vende ações novas ao público. Marque tudo o que é verdade.",
      ),
      select: "all",
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "placement-ipo-facts-select",
    skill: "ipo",
  },
  {
    content: {
      question: t(
        "Put these in the order your buy order travels.",
        "Coloque na ordem o caminho da sua ordem de compra.",
      ),
      reason: t(
        "Your order goes from the app to your broker, the broker sends it to the exchange, and there it meets a seller's order.",
        "Sua ordem vai do aplicativo para a corretora, a corretora envia para a Bolsa e lá ela encontra a ordem de um vendedor.",
      ),
      steps: [
        t("You tap buy in the app", "Você toca em comprar no aplicativo"),
        t("Your broker gets the order", "A corretora recebe a ordem"),
        t("It sends it to the exchange", "Ela envia a ordem para a Bolsa"),
        t("It meets a seller's order", "Ela encontra a ordem de um vendedor"),
      ],
    },
    difficulty: 0,
    format: "order",
    key: "placement-broker-order-path-order",
    skill: "brokers",
  },
  {
    content: {
      pairs: [
        { left: t("You", "Você"), right: t("Decide what to buy", "Decide o que comprar") },
        { left: t("Broker", "Corretora"), right: t("Sends your order", "Envia sua ordem") },
        {
          left: t("Exchange", "Bolsa"),
          right: t("Matches buys and sells", "Junta compra e venda"),
        },
        { left: t("Seller", "Vendedor"), right: t("Hands over the shares", "Entrega as ações") },
      ],
      question: t(
        "Match each one to its part in buying a share.",
        "Ligue cada um ao seu papel na compra de uma ação.",
      ),
      reason: t(
        "You choose, your broker carries the order, the exchange matches it with another person's order, and that seller hands over the shares.",
        "Você escolhe, a corretora leva a ordem, a Bolsa junta com a ordem de outra pessoa e esse vendedor entrega as ações.",
      ),
    },
    difficulty: -1,
    format: "matchPairs",
    key: "placement-broker-roles-match",
    skill: "brokers",
  },
  {
    content: {
      context: null,
      fixedOrder: false,
      options: [
        bankOption(
          t("They pass your orders to the exchange", "Elas levam suas ordens até a Bolsa"),
          t("That's a broker's main job.", "É o principal papel da corretora."),
        ),
        bankOption(
          t("They may charge a fee per trade", "Elas podem cobrar uma taxa por operação"),
          t(
            "Some brokers charge for each order; others don't.",
            "Algumas corretoras cobram por ordem; outras não.",
          ),
        ),
        bankOption(
          t(
            "You can move your shares to another broker",
            "Você pode levar suas ações para outra corretora",
          ),
          t(
            "The shares are yours, not the broker's, so they can be transferred.",
            "As ações são suas, não da corretora, então podem ser transferidas.",
          ),
        ),
        bankOption(
          t("They set the price you pay", "Elas definem o preço que você paga"),
          t(
            "The price comes from buyers and sellers at the exchange.",
            "O preço vem de compradores e vendedores na Bolsa.",
          ),
          t("Thinks the broker sets prices", "Acha que a corretora define os preços"),
        ),
        bankOption(
          t("They promise your stocks won't fall", "Elas garantem que suas ações não vão cair"),
          t(
            "No broker can promise what prices will do.",
            "Nenhuma corretora pode garantir o que os preços vão fazer.",
          ),
          t("Thinks brokers cover market losses", "Acha que a corretora cobre perdas na Bolsa"),
        ),
      ],
      question: t(
        "Select everything that is true about brokers.",
        "Marque tudo o que é verdade sobre corretoras.",
      ),
      select: "all",
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "placement-broker-facts-select",
    skill: "brokers",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t("From the profit the company made", "Do lucro que a empresa teve"),
          t(
            "A dividend is a slice of the profit handed to the owners.",
            "O dividendo é uma parte do lucro repassada aos donos.",
          ),
        ),
        bankOption(
          t("From the stock exchange", "Da bolsa de valores"),
          t(
            "The exchange only hosts the trades; it pays nobody a dividend.",
            "A bolsa só organiza as negociações; ela não paga dividendo a ninguém.",
          ),
          t("Thinks the exchange pays shareholders", "Acha que a bolsa paga os acionistas"),
        ),
        bankOption(
          t("From the people buying the stock that day", "De quem compra a ação naquele dia"),
          t(
            "Buyers pay the seller for the share, not the company's owners.",
            "Quem compra paga a quem vende a ação, não aos donos da empresa.",
          ),
          t("Mixes up a dividend with a sale", "Confunde dividendo com venda"),
        ),
        bankOption(
          t("From interest the bank adds to your account", "De juros que o banco põe na sua conta"),
          t(
            "Interest is what a bank pays on a deposit; a dividend comes from the company.",
            "Juros é o que o banco paga por um depósito; o dividendo vem da empresa.",
          ),
          t("Mixes up dividends and interest", "Confunde dividendos com juros"),
        ),
      ],
      question: t(
        "A company pays its shareholders a dividend. Where does that money come from?",
        "Uma empresa paga dividendos aos acionistas. De onde vem esse dinheiro?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "placement-dividends-source",
    skill: "dividends",
  },
];
