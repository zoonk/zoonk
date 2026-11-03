import { type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";

/** Plans written before beginner lessons opened with a scene, as stored lessons still have them. */
export const NOVICE_LESSON_SPECS = {
  "pt-niveis-ecologicos-beginner": {
    canDo: "Distinguir organismo, população, comunidade e ecossistema",
    description:
      "Apresenta os níveis ecológicos para distinguir um ser vivo, grupos de seres vivos e suas relações com o ambiente.",
    estimatedMinutes: 4,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Pergunte: «Qual destas coisas não está viva, mas um sapo precisa dela?» Opções: água, outro sapo, planta. Revele imediatamente que a resposta é água; deixe a explicação para as próximas telas.",
        kind: "hook",
        skills: [],
        visual: "Um lago com água, sapos-cururus e plantas aquáticas.",
      },
      {
        activityTemplate: null,
        brief:
          "Retome brevemente que um organismo é um ser vivo inteiro, como um sapo-cururu. Apresente espécie como um grupo de seres vivos semelhantes que podem se reproduzir entre si e gerar descendentes férteis; os sapos-cururus mostrados pertencem à mesma espécie.",
        kind: "explanation",
        skills: [0],
        visual:
          "O lago com um sapo-cururu destacado e outros sapos-cururus da mesma espécie visíveis.",
      },
      {
        activityTemplate: null,
        brief:
          "Explique que uma população reúne os organismos de uma mesma espécie que vivem em uma área ao mesmo tempo. No lago, todos os sapos-cururus formam uma população.",
        kind: "explanation",
        skills: [0],
        visual:
          "O lago com todos os sapos-cururus destacados como um grupo; plantas aquáticas e água ao redor.",
      },
      {
        activityTemplate: null,
        brief:
          "Uma pessoa junta a contagem de todos os sapos-cururus de dois lagos separados e chama o resultado de população de um dos lagos. Peça que identifique o erro: a população de cada lago reúne os sapos daquela área. Inclua a alternativa tentadora de que basta serem da mesma espécie, mesmo em áreas separadas.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Explique que uma comunidade reúne todas as populações de seres vivos de uma área. No lago, ela inclui tanto os sapos-cururus quanto os aguapés e os demais seres vivos presentes.",
        kind: "explanation",
        skills: [0],
        visual:
          "O lago com sapos-cururus, aguapés e outros seres vivos destacados; água e solo ao redor sem destaque.",
      },
      {
        activityTemplate: null,
        brief:
          "Alguém junta os sapos-cururus e os aguapés do lago e diz que todos formam uma única população. Peça que avalie a afirmação: são populações de espécies diferentes. Inclua a alternativa tentadora de que todos formam uma população porque vivem no mesmo lago.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Explique que um ecossistema inclui a comunidade, os componentes não vivos do ambiente e as relações entre eles. No lago, os seres vivos se relacionam com a água, o solo e a luz; por exemplo, os aguapés usam água e luz.",
        kind: "explanation",
        skills: [0],
        visual:
          "O lago com sapos-cururus, aguapés, outros seres vivos, água e solo; luz do Sol chegando aos aguapés.",
      },
      {
        activityTemplate: "categorize",
        brief:
          "Peça que classifique quatro descrições do lago nos níveis organismo, população, comunidade e ecossistema: um sapo-cururu; todos os sapos-cururus do lago; todos os seres vivos do lago; e os seres vivos, a água, o solo, a luz e suas relações. Na devolutiva, contraste especialmente a comunidade com o ecossistema.",
        kind: "activity",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Murilo quer estudar no lago como os seres vivos se relacionam com a água e a luz. Peça que escolha qual recorte atende ao objetivo e justifique: o ecossistema, com seres vivos, componentes não vivos e relações. Inclua como alternativa tentadora apenas a comunidade de seres vivos.",
        kind: "application",
        skills: [0],
        visual: null,
      },
    ],
    skills: [
      {
        description:
          "Distinguir os níveis ecológicos pelo que cada um inclui, de um ser vivo às relações entre seres vivos e componentes não vivos.",
        example: "Um sapo é um organismo; todos os sapos-cururus de um lago formam uma população.",
        hard: false,
        name: "Distinguir níveis de organização ecológica",
        topic: "Níveis de organização ecológica",
        useCase:
          "Escolher o recorte adequado para estudar os seres vivos de um lago e seu ambiente.",
      },
    ],
    supportMode: "explanationFirst",
    title: "Níveis de organização ecológica",
  },
  "pt-patrimonio-liquido-beginner": {
    canDo: "Calcular o patrimônio líquido a partir de bens, direitos e obrigações",
    description:
      "O patrimônio líquido é a diferença entre bens e direitos e obrigações, útil para avaliar a posição da entidade.",
    estimatedMinutes: 4,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Davi quer estimar o que restaria do valor dos recursos de sua oficina depois de descontar o que ela deve. O que ele precisa considerar: só o dinheiro; o dinheiro e as ferramentas, descontando a dívida; ou só o valor das ferramentas? A segunda opção é correta; revele-a assim que ele escolher e deixe a explicação para a próxima tela.",
        kind: "hook",
        skills: [],
        visual: "Davi em sua oficina, com ferramentas, dinheiro no caixa e um documento de dívida.",
      },
      {
        activityTemplate: "formulaModel",
        brief:
          "Explique que patrimônio líquido é o valor dos bens e direitos da empresa menos suas obrigações; é um valor contábil, não uma previsão do preço de venda. Mostre o modelo da oficina de Davi: patrimônio líquido = bens + direitos − obrigações, com controles de R$ 0,00 a R$ 10.000,00 para cada parcela, iniciando em R$ 6.000,00, R$ 2.000,00 e R$ 3.000,00, respectivamente; trace o patrimônio líquido conforme as obrigações variam.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Resolva passo a passo com os valores da oficina de Davi: apresente uma tabela com bens de R$ 6.000,00, direitos de R$ 2.000,00 e obrigações de R$ 3.000,00. Some bens e direitos, obtendo R$ 8.000,00, e subtraia as obrigações para chegar ao patrimônio líquido de R$ 5.000,00.",
        kind: "workedExample",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Peça que calcule o patrimônio líquido de uma empresa com bens de R$ 4.000,00, direitos de R$ 1.000,00 e obrigações de R$ 2.000,00; mostre os três valores em uma tabela. A resposta é R$ 3.000,00; inclua R$ 5.000,00 como erro tentador por não descontar as obrigações.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Explique que, se as obrigações forem maiores que a soma dos bens e direitos, o patrimônio líquido será negativo. Em uma tabela para a oficina de Davi, mostre bens e direitos de R$ 4.000,00, obrigações de R$ 5.000,00 e a diferença de −R$ 1.000,00: as obrigações superam os recursos em R$ 1.000,00.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: "formulaModel",
        brief:
          "No modelo da oficina de Davi, mantenha bens em R$ 6.000,00 e direitos em R$ 2.000,00; permita variar as obrigações de R$ 0,00 a R$ 10.000,00 e trace o patrimônio líquido. Peça que mova as obrigações de R$ 3.000,00 para R$ 5.000,00 e identifique o novo patrimônio líquido, R$ 3.000,00; inclua R$ 10.000,00 como erro de somar a dívida.",
        kind: "activity",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Davi confere os valores da oficina: dinheiro de R$ 1.000,00, ferramentas de R$ 7.000,00, valor a receber de cliente de R$ 2.000,00, dívida bancária de R$ 4.000,00 e valor devido a fornecedor de R$ 1.500,00; mostre-os em uma tabela. Peça o patrimônio líquido, R$ 4.500,00, e inclua R$ 8.500,00 como erro de descontar apenas o fornecedor.",
        kind: "application",
        skills: [0],
        visual: null,
      },
    ],
    skills: [
      {
        description: "Somar os valores dos bens e direitos e subtrair as obrigações da entidade.",
        example:
          "Bens de R$ 4.000,00 e direitos de R$ 1.000,00 menos obrigações de R$ 2.000,00 resultam em patrimônio líquido de R$ 3.000,00.",
        hard: true,
        name: "Calcular o patrimônio líquido",
        topic: "Patrimônio líquido",
        useCase: "Conferir a posição patrimonial de uma empresa a partir de seus registros.",
      },
    ],
    supportMode: "explanationFirst",
    title: "Patrimônio líquido",
  },
  "pt-receitas-regulares-overview": {
    canDo: "Distinguir receitas regulares de receitas eventuais",
    description: "Mostra como distinguir entradas de dinheiro pela frequência com que acontecem.",
    estimatedMinutes: 3,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Igor conserta objetos quando aparecem clientes. Se não aparecer nenhum conserto em um mês, o que acontece com o dinheiro desses consertos? Opções: «Não recebe por consertos» (correta) e «Recebe mesmo sem consertos». Mostre a resposta assim que a pessoa escolher.",
        kind: "hook",
        skills: [],
        visual:
          "Igor em uma bancada de consertos, recebendo de um cliente um objeto para consertar.",
      },
      {
        activityTemplate: null,
        brief:
          "Explique que receita é dinheiro que Igor recebe, como o salário do emprego ou o pagamento por um conserto.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Explique que uma receita regular volta a ser recebida em intervalos habituais; o valor pode mudar. Mostre uma tabela do salário de Igor: janeiro, fevereiro e março, com «recebido» em cada mês.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Igor recebe pagamento por um serviço toda semana, mas o valor varia. Pergunte se essa receita é regular; a resposta é sim. Inclua como alternativa tentadora «Não, porque o valor muda».",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Explique que uma receita eventual acontece sem intervalos habituais, como o pagamento por consertos que aparecem de vez em quando. Mostre uma tabela dos consertos de Igor: janeiro, «recebeu»; fevereiro, «não recebeu»; março, «recebeu»; abril, «não recebeu».",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: "categorize",
        brief:
          "Peça para separar as receitas de Igor em «regulares» e «eventuais»: salário recebido todo mês e serviço pago toda semana vão em regulares; conserto recebido uma única vez e venda única de um objeto vão em eventuais. Pergunte em qual grupo fica cada uma e destaque a frequência como critério.",
        kind: "activity",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Igor recebe salário todo mês e aceita consertos apenas quando aparecem clientes. Para pensar nas entradas dos próximos meses, peça que escolha entre «Considerar o salário regular e os consertos eventuais» (correta) e «Contar com consertos todo mês» (tentadora).",
        kind: "application",
        skills: [0],
        visual: null,
      },
    ],
    skills: [
      {
        description:
          "Distinguir receitas que chegam em intervalos habituais daquelas que aparecem sem regularidade.",
        example:
          "Um salário mensal é regular; um conserto feito uma única vez gera receita eventual.",
        hard: false,
        name: "Distinguir receitas regulares de eventuais",
        topic: "Frequência das receitas",
        useCase:
          "Reconhecer quais entradas de dinheiro têm frequência habitual ao pensar nos próximos meses.",
      },
    ],
    supportMode: "explanationFirst",
    title: "Receitas regulares e eventuais",
  },
} as const satisfies Record<string, LessonSpec>;
