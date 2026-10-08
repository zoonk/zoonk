import { type LessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec/rules";

/**
 * Lessons whose questions are about something to see (6 Oct 2026, after an owner found a
 * Câmara "Imagens e legendas" lesson that described its pictures in words and a check that
 * wrote its table as "7h → 9; 8h → 5"). The writer must show them: a picture on every question
 * about one, the data as a Markdown table, a chart or a timeline drawn from data.
 */
export const VISUAL_LESSON_SPECS = {
  /**
   * A plan that asked for a picture of data (Oct 2026, "native visuals first"): the writer draws a
   * curve of balances as the app's line chart, never as a generated picture.
   */
  "en-compound-interest-beginner": {
    canDo: "Work out how a balance grows with compound interest",
    description: "See why interest on interest makes savings grow faster each year.",
    estimatedMinutes: 3,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Guess first: $1,000 earns 10% a year and the interest stays in. After 3 years, is the balance $1,300, $1,331 or $1,030? Reveal $1,331 at once.",
        kind: "hook",
        skills: [],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Compound interest: each year's interest is added to the balance, so next year's 10% is taken on more money. Year 1 adds $100, year 2 adds $110, year 3 adds $121.",
        kind: "explanation",
        skills: [0],
        visual:
          "A curve of the balance growing year by year: $1,000 at the start, $1,100, $1,210 and $1,331 after 3 years.",
      },
      {
        activityTemplate: null,
        brief:
          "Kai saves $2,000 at 5% a year with interest kept in. Ask for the balance after 2 years: $2,205. Tempting wrong answer: $2,200 (5% of $2,000 twice).",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Simple interest pays 10% of the first $1,000 every year: $1,300 after 3 years, against $1,331 with compound interest. Show both balances side by side.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Lena compares two accounts for $1,500 over 2 years at 4%: simple or compound. Ask how much more the compound one pays: $2.40. Tempting wrong answer: $0.",
        kind: "application",
        skills: [0],
        visual: null,
      },
    ],
    skills: [
      {
        description: "With compound interest, each year's interest earns interest the next year.",
        example: "$1,000 at 10% becomes $1,100, then $1,210, then $1,331.",
        hard: true,
        name: "Calculate a balance with compound interest",
        topic: "Compound interest",
        useCase: "Comparing savings accounts and loans.",
      },
    ],
    supportMode: "explanationFirst",
    title: "Compound interest",
  },
  /**
   * A real spec (6 Oct 2026) whose writer labeled options "Desenho 1/2/3" and asked to "observe
   * os dois desenhos" with no picture: two drawings compared are one picture labeled 1 and 2, and
   * "which chart fits the data" shows one chart and asks about it.
   */
  "pt-graficos-de-barras-beginner": {
    canDo: "Criar um gráfico de barras com categorias legíveis",
    description:
      "Mostra como transformar contagens por categoria em barras fáceis de comparar, sem trocar valores ou apertar os nomes.",
    estimatedMinutes: 3,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Otávio contou pedidos em Teresina: retirada 3, entrega 6 e balcão 4. Mostre três desenhos com faixas para essas opções, sempre nessa ordem: comprimentos 3–4–6, 3–6–4 e 6–3–4; pergunte qual representa a contagem, revele que é o segundo.",
        kind: "hook",
        skills: [],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Apresente o gráfico de barras: cada barra representa uma categoria, e um número maior pede uma barra mais comprida. Mostre três categorias com 2, 5 e 7 ocorrências em barras que partem do mesmo ponto.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Peça ao aluno que escolha o gráfico para os dados visita 6, telefonema 3 e mensagem 8; mostre as três opções como gráficos de barras com os nomes visíveis. A correta mantém 6–3–8; inclua a opção tentadora 6–8–3.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Nomes compridos ficam apertados sob barras em pé; com barras deitadas, há espaço para o nome ao lado de cada uma sem mudar os valores. Compare duas versões dos mesmos dados: atendimento presencial 5, pedido pelo aplicativo 8 e retirada com agendamento 3.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Para entrega na portaria do prédio 7 e retirada em horário combinado 4, peça que o aluno escolha entre dois desenhos com os mesmos comprimentos: barras deitadas com nomes inteiros ou barras em pé com nomes cortados. A segunda é tentadora porque os comprimentos estão certos.",
        kind: "application",
        skills: [0],
        visual: null,
      },
    ],
    skills: [
      {
        description:
          "Transformar contagens por categoria em barras com comprimentos correspondentes e nomes que possam ser lidos.",
        example:
          "Para 3, 6 e 4 pedidos em três canais, desenhar barras de comprimentos 3, 6 e 4 junto aos respectivos nomes.",
        hard: true,
        name: "Criar um gráfico de barras",
        topic: "Gráficos de barras",
        useCase:
          "Apresentar contagens de pedidos ou respostas para comparar categorias no trabalho.",
      },
    ],
    supportMode: "explanationFirst",
    title: "Gráficos de barras",
  },
  "pt-imagens-e-legendas-beginner": {
    canDo: "Escolher a legenda que corresponde ao que uma imagem mostra",
    description:
      "Comparar imagem e legenda pelo que aparece nas duas: quem ou o quê, a ação e detalhes como cor e quantidade.",
    estimatedMinutes: 3,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Guess first: a picture shows Danilo standing at a door holding a closed red umbrella. Which caption fits: he holds a closed red umbrella; he walks in the rain under an open red umbrella; he holds a red backpack.",
        kind: "hook",
        skills: [],
        visual: "Danilo standing at a door, holding a closed red umbrella; no rain.",
      },
      {
        activityTemplate: null,
        brief:
          "A caption is the text that goes with a picture, like a label: it should say what the picture shows. Check three things in both: who or what, the action, and details like color and quantity.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "The picture shows Otávio standing next to a blue bicycle; he isn't riding it. The learner picks the caption that fits. Tempting wrong caption: 'Otávio rides a blue bicycle' (right color and object, wrong action).",
        kind: "check",
        skills: [0],
        visual: "Otávio standing still next to a blue bicycle, both feet on the ground.",
      },
      {
        activityTemplate: null,
        brief:
          "Quantity matters too: three boxes stacked fit 'Três caixas empilhadas', not 'Duas caixas empilhadas'.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Two scenes side by side, labeled 1 and 2: in 1 Nayara puts a book into a red box; in 2 she takes a book out of it. The learner picks which scene fits 'Nayara coloca um livro na caixa vermelha'. Tempting wrong answer: scene 2 (same box and book, opposite action).",
        kind: "application",
        skills: [0],
        visual:
          "Two panels labeled 1 and 2: in 1 Nayara puts a book into a red box; in 2 she takes a book out of the same red box.",
      },
    ],
    skills: [
      {
        description:
          "A caption fits a picture when who or what, the action and the details (color, quantity) all match what the picture shows.",
        example:
          "Otávio standing next to a blue bike fits 'Otávio está ao lado de uma bicicleta azul'.",
        hard: false,
        name: "Relacionar imagem e legenda",
        topic: "Imagens e legendas",
        useCase: "Interpretar charges, anúncios e fotos com legenda em provas de português.",
      },
    ],
    supportMode: "explanationFirst",
    title: "Imagens e legendas",
  },
  "pt-tabela-e-grafico-beginner": {
    canDo: "Ler uma tabela e um gráfico de barras e comparar seus valores",
    description:
      "Encontrar um valor exato numa tabela, comparar categorias num gráfico de barras e saber o que os dados não dizem.",
    estimatedMinutes: 3,
    screens: [
      {
        activityTemplate: null,
        brief:
          "A sector's office kept a table of official letters received per month: May 40, June 30, July 45. Guess first which month had the fewest.",
        kind: "hook",
        skills: [],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "A table puts each record in a row: find the row, then read the column you need. Use the same letters table (May 40, June 30, July 45).",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "A bar chart of letters answered per month (May 35, June 36, July 40). The learner says in which month more letters were answered than received (June: 36 answered, 30 received). Tempting wrong answer: July, the tallest bar.",
        kind: "check",
        skills: [0, 1],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Data shows only what was recorded: answering more letters than were received in June doesn't mean a mistake, since some may have arrived in May.",
        kind: "explanation",
        skills: [1],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "A table of bikes available at a station by hour (7h: 9, 8h: 5, 9h: 9). The learner picks the two hours with the same number. Tempting wrong answer: 8h and 9h.",
        kind: "application",
        skills: [0],
        visual: null,
      },
    ],
    skills: [
      {
        description: "Find an exact value in a table by its row and column, and compare values.",
        example: "In the table, June has 30 letters received.",
        hard: false,
        name: "Ler valores numa tabela",
        topic: "Tabelas",
        useCase: "Questões de raciocínio e interpretação de dados em concursos.",
      },
      {
        description: "Compare categories in a bar chart and say only what the data supports.",
        example: "In June, 36 letters were answered and 30 received.",
        hard: false,
        name: "Comparar dados num gráfico de barras",
        topic: "Gráficos",
        useCase: "Ler relatórios e indicadores no trabalho.",
      },
    ],
    supportMode: "explanationFirst",
    title: "Tabela e gráfico de barras",
  },
} as const satisfies Record<string, LessonSpec>;
