import { type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";

/** Beginner plans as a planner wrote them; the older ones open with a guess, as stored plans do. */
export const NOVICE_LESSON_SPECS = {
  "pt-entidade-contabil-beginner": {
    canDo: "Separar operações da entidade das operações dos proprietários",
    description:
      "A lição mostra como distinguir o patrimônio e as operações da empresa daqueles de seu proprietário.",
    estimatedMinutes: 5,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Renan é dono de uma empresa e usa dinheiro dela para pagar uma conta de sua casa. Essa conta passa a ser um gasto da empresa?",
        kind: "hook",
        skills: [],
        visual: "Renan na empresa, junto ao caixa e a uma conta identificada como conta de casa.",
        visualKind: "picture",
      },
      {
        activityTemplate: null,
        brief:
          "Explique que a entidade contábil é a empresa considerada separadamente de seu dono. Mesmo que Renan seja o único proprietário, os bens e as dívidas dele não se confundem automaticamente com os da empresa.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Apresente a autonomia patrimonial como essa separação entre o patrimônio da empresa e o do proprietário. Explique que importa a quem pertence o bem ou a dívida e a quem a operação beneficia, não apenas de onde saiu o dinheiro.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Mostre passo a passo: Renan paga com dinheiro pessoal um material para a empresa e combina que ela o reembolsará. O material pertence à empresa, e a empresa fica devendo a Renan; o pagamento não torna o material uma compra pessoal.",
        kind: "workedExample",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Renan paga com dinheiro pessoal o conserto de um equipamento da empresa, com reembolso combinado. Peça para identificar a operação da empresa e inclua como erro tentador tratá-la como gasto pessoal porque ele pagou.",
        kind: "check",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Retome a conta de casa: se a empresa a paga e Renan se compromete a devolver o valor, sai dinheiro da empresa e ela passa a ter um valor a receber dele. A conta continua sendo pessoal, não uma despesa da empresa.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Explique que nem todo pagamento pessoal feito pela empresa gera automaticamente um valor a receber: é preciso verificar o que foi combinado e documentado. Por exemplo, uma retirada de lucros não é uma despesa da empresa nem, por si só, uma dívida do proprietário com ela.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "A empresa paga uma conta pessoal de Renan, que se compromete a reembolsá-la. Peça para decidir o que a empresa tem após o pagamento; inclua como erro tentador registrar a conta como despesa da empresa.",
        kind: "check",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Explique que uma dívida pessoal não vira dívida da empresa só porque a pessoa é dona dela. Da mesma forma, uma dívida da empresa não vira automaticamente dívida pessoal do dono; garantias e outras obrigações precisam ser verificadas.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Mostre que, quando Renan coloca dinheiro pessoal na empresa como investimento, o dinheiro passa a ser da empresa e aumenta a participação dele nela. Essa entrada não é uma venda da empresa.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Renan investe dinheiro pessoal na empresa; depois, ela paga uma conta de casa dele, com reembolso combinado. Peça para identificar o efeito de cada operação para a empresa e inclua como erro tentador tratar a entrada como venda e a conta como despesa da empresa.",
        kind: "application",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
    ],
    skills: [
      {
        description:
          "Distinguir bens, dívidas e operações da empresa daqueles de seu proprietário, inclusive quando há pagamentos entre eles.",
        example:
          "O dono paga um material da empresa e combina reembolso: a empresa recebe o material e fica devendo a ele.",
        hard: true,
        name: "Aplicar a autonomia patrimonial",
        topic: "Autonomia patrimonial",
        useCase:
          "Organizar os registros de uma empresa sem confundir gastos do negócio com gastos do proprietário.",
      },
    ],
    supportMode: "explanationFirst",
    title: "Entidade contábil",
  },
  "pt-equacao-patrimonial-beginner": {
    canDo: "Aplicar a equação patrimonial a valores simples",
    description:
      "A equação patrimonial relaciona ativo, passivo e patrimônio líquido e ajuda a conferir os totais de uma entidade.",
    estimatedMinutes: 5,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Débora confere os registros da empresa e vê quanto ela tem e quanto deve. Como saber se os totais fecham?",
        kind: "hook",
        skills: [],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Mostre uma tabela dos totais da empresa de Débora na mesma data: ativo de R$ 12.000,00, passivo de R$ 4.000,00 e patrimônio líquido de R$ 8.000,00. Lembre brevemente que o ativo reúne bens e direitos, o passivo reúne obrigações e o patrimônio líquido é a diferença entre eles.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: "formulaModel",
        brief:
          "Apresente a equação patrimonial: ativo = passivo + patrimônio líquido. No modelo, use controles de R$ 0,00 a R$ 10.000,00 em passos de R$ 1.000,00 para passivo e patrimônio líquido, começando em R$ 4.000,00 e R$ 8.000,00; mostre o ativo como a soma e seu gráfico em função do passivo.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "template",
      },
      {
        activityTemplate: null,
        brief:
          "Resolva o caso de Débora: some o passivo de R$ 4.000,00 ao patrimônio líquido de R$ 8.000,00 para obter um ativo de R$ 12.000,00. Mostre que esse resultado é igual ao total do ativo registrado.",
        kind: "workedExample",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: "formulaModel",
        brief:
          "No modelo ativo = passivo + patrimônio líquido, com os dois controles de R$ 0,00 a R$ 10.000,00 em passos de R$ 1.000,00, peça para ajustar o passivo a R$ 3.000,00 e o patrimônio líquido a R$ 5.000,00 e informar o ativo. A resposta é R$ 8.000,00; trate R$ 2.000,00 como erro de subtrair os valores.",
        kind: "activity",
        skills: [0],
        visual: null,
        visualKind: "template",
      },
      {
        activityTemplate: null,
        brief:
          "Mostre que, quando falta o passivo, ele pode ser encontrado por ativo menos patrimônio líquido. Lembre que, quando falta o patrimônio líquido, ele é o ativo menos o passivo.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Uma empresa registra ativo de R$ 15.000,00 e patrimônio líquido de R$ 9.000,00. Peça o passivo e inclua R$ 24.000,00 como erro de somar os dois valores.",
        kind: "check",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Explique que o patrimônio líquido pode ser zero: nesse caso, o ativo e o passivo têm o mesmo valor. Por exemplo, R$ 7.000,00 = R$ 7.000,00 + R$ 0,00.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Explique que, quando o passivo supera o ativo, o patrimônio líquido é negativo e a igualdade continua válida. Por exemplo, R$ 8.000,00 = R$ 11.000,00 + (−R$ 3.000,00).",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Uma empresa tem ativo de R$ 6.000,00 e passivo de R$ 9.000,00. Peça o patrimônio líquido que faz a igualdade fechar e inclua R$ 3.000,00 como erro de ignorar o sinal negativo.",
        kind: "check",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Mostre uma tabela de conferência com ativo de R$ 20.000,00, passivo de R$ 14.000,00 e patrimônio líquido registrado de R$ 8.000,00. Informe que os dois primeiros totais estão corretos e peça o valor que corrige o patrimônio líquido; explique no retorno que a igualdade, sozinha, não garante que os registros estejam corretos.",
        kind: "application",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
    ],
    skills: [
      {
        description:
          "Usar a igualdade entre ativo, passivo e patrimônio líquido para calcular ou conferir um total patrimonial.",
        example:
          "Ativo de R$ 12.000,00 = passivo de R$ 4.000,00 + patrimônio líquido de R$ 8.000,00.",
        hard: true,
        name: "Aplicar a equação patrimonial",
        topic: "Equação patrimonial",
        useCase: "Conferir os totais patrimoniais registrados por uma empresa.",
      },
    ],
    supportMode: "explanationFirst",
    title: "Equação patrimonial",
  },
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
        visualKind: "picture",
      },
      {
        activityTemplate: null,
        brief:
          "Retome brevemente que um organismo é um ser vivo inteiro, como um sapo-cururu. Apresente espécie como um grupo de seres vivos semelhantes que podem se reproduzir entre si e gerar descendentes férteis; os sapos-cururus mostrados pertencem à mesma espécie.",
        kind: "explanation",
        skills: [0],
        visual:
          "O lago com um sapo-cururu destacado e outros sapos-cururus da mesma espécie visíveis.",
        visualKind: "picture",
      },
      {
        activityTemplate: null,
        brief:
          "Explique que uma população reúne os organismos de uma mesma espécie que vivem em uma área ao mesmo tempo. No lago, todos os sapos-cururus formam uma população.",
        kind: "explanation",
        skills: [0],
        visual:
          "O lago com todos os sapos-cururus destacados como um grupo; plantas aquáticas e água ao redor.",
        visualKind: "picture",
      },
      {
        activityTemplate: null,
        brief:
          "Uma pessoa junta a contagem de todos os sapos-cururus de dois lagos separados e chama o resultado de população de um dos lagos. Peça que identifique o erro: a população de cada lago reúne os sapos daquela área. Inclua a alternativa tentadora de que basta serem da mesma espécie, mesmo em áreas separadas.",
        kind: "check",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Explique que uma comunidade reúne todas as populações de seres vivos de uma área. No lago, ela inclui tanto os sapos-cururus quanto os aguapés e os demais seres vivos presentes.",
        kind: "explanation",
        skills: [0],
        visual:
          "O lago com sapos-cururus, aguapés e outros seres vivos destacados; água e solo ao redor sem destaque.",
        visualKind: "picture",
      },
      {
        activityTemplate: null,
        brief:
          "Alguém junta os sapos-cururus e os aguapés do lago e diz que todos formam uma única população. Peça que avalie a afirmação: são populações de espécies diferentes. Inclua a alternativa tentadora de que todos formam uma população porque vivem no mesmo lago.",
        kind: "check",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Explique que um ecossistema inclui a comunidade, os componentes não vivos do ambiente e as relações entre eles. No lago, os seres vivos se relacionam com a água, o solo e a luz; por exemplo, os aguapés usam água e luz.",
        kind: "explanation",
        skills: [0],
        visual:
          "O lago com sapos-cururus, aguapés, outros seres vivos, água e solo; luz do Sol chegando aos aguapés.",
        visualKind: "picture",
      },
      {
        activityTemplate: "categorize",
        brief:
          "Peça que classifique quatro descrições do lago nos níveis organismo, população, comunidade e ecossistema: um sapo-cururu; todos os sapos-cururus do lago; todos os seres vivos do lago; e os seres vivos, a água, o solo, a luz e suas relações. Na devolutiva, contraste especialmente a comunidade com o ecossistema.",
        kind: "activity",
        skills: [0],
        visual: null,
        visualKind: "template",
      },
      {
        activityTemplate: null,
        brief:
          "Murilo quer estudar no lago como os seres vivos se relacionam com a água e a luz. Peça que escolha qual recorte atende ao objetivo e justifique: o ecossistema, com seres vivos, componentes não vivos e relações. Inclua como alternativa tentadora apenas a comunidade de seres vivos.",
        kind: "application",
        skills: [0],
        visual: null,
        visualKind: "none",
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
        visualKind: "picture",
      },
      {
        activityTemplate: "formulaModel",
        brief:
          "Explique que patrimônio líquido é o valor dos bens e direitos da empresa menos suas obrigações; é um valor contábil, não uma previsão do preço de venda. Mostre o modelo da oficina de Davi: patrimônio líquido = bens + direitos − obrigações, com controles de R$ 0,00 a R$ 10.000,00 para cada parcela, iniciando em R$ 6.000,00, R$ 2.000,00 e R$ 3.000,00, respectivamente; trace o patrimônio líquido conforme as obrigações variam.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "template",
      },
      {
        activityTemplate: null,
        brief:
          "Resolva passo a passo com os valores da oficina de Davi: apresente uma tabela com bens de R$ 6.000,00, direitos de R$ 2.000,00 e obrigações de R$ 3.000,00. Some bens e direitos, obtendo R$ 8.000,00, e subtraia as obrigações para chegar ao patrimônio líquido de R$ 5.000,00.",
        kind: "workedExample",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Peça que calcule o patrimônio líquido de uma empresa com bens de R$ 4.000,00, direitos de R$ 1.000,00 e obrigações de R$ 2.000,00; mostre os três valores em uma tabela. A resposta é R$ 3.000,00; inclua R$ 5.000,00 como erro tentador por não descontar as obrigações.",
        kind: "check",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Explique que, se as obrigações forem maiores que a soma dos bens e direitos, o patrimônio líquido será negativo. Em uma tabela para a oficina de Davi, mostre bens e direitos de R$ 4.000,00, obrigações de R$ 5.000,00 e a diferença de −R$ 1.000,00: as obrigações superam os recursos em R$ 1.000,00.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: "formulaModel",
        brief:
          "No modelo da oficina de Davi, mantenha bens em R$ 6.000,00 e direitos em R$ 2.000,00; permita variar as obrigações de R$ 0,00 a R$ 10.000,00 e trace o patrimônio líquido. Peça que mova as obrigações de R$ 3.000,00 para R$ 5.000,00 e identifique o novo patrimônio líquido, R$ 3.000,00; inclua R$ 10.000,00 como erro de somar a dívida.",
        kind: "activity",
        skills: [0],
        visual: null,
        visualKind: "template",
      },
      {
        activityTemplate: null,
        brief:
          "Davi confere os valores da oficina: dinheiro de R$ 1.000,00, ferramentas de R$ 7.000,00, valor a receber de cliente de R$ 2.000,00, dívida bancária de R$ 4.000,00 e valor devido a fornecedor de R$ 1.500,00; mostre-os em uma tabela. Peça o patrimônio líquido, R$ 4.500,00, e inclua R$ 8.500,00 como erro de descontar apenas o fornecedor.",
        kind: "application",
        skills: [0],
        visual: null,
        visualKind: "none",
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
        visualKind: "picture",
      },
      {
        activityTemplate: null,
        brief:
          "Explique que receita é dinheiro que Igor recebe, como o salário do emprego ou o pagamento por um conserto.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Explique que uma receita regular volta a ser recebida em intervalos habituais; o valor pode mudar. Mostre uma tabela do salário de Igor: janeiro, fevereiro e março, com «recebido» em cada mês.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Igor recebe pagamento por um serviço toda semana, mas o valor varia. Pergunte se essa receita é regular; a resposta é sim. Inclua como alternativa tentadora «Não, porque o valor muda».",
        kind: "check",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Explique que uma receita eventual acontece sem intervalos habituais, como o pagamento por consertos que aparecem de vez em quando. Mostre uma tabela dos consertos de Igor: janeiro, «recebeu»; fevereiro, «não recebeu»; março, «recebeu»; abril, «não recebeu».",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: "categorize",
        brief:
          "Peça para separar as receitas de Igor em «regulares» e «eventuais»: salário recebido todo mês e serviço pago toda semana vão em regulares; conserto recebido uma única vez e venda única de um objeto vão em eventuais. Pergunte em qual grupo fica cada uma e destaque a frequência como critério.",
        kind: "activity",
        skills: [0],
        visual: null,
        visualKind: "template",
      },
      {
        activityTemplate: null,
        brief:
          "Igor recebe salário todo mês e aceita consertos apenas quando aparecem clientes. Para pensar nas entradas dos próximos meses, peça que escolha entre «Considerar o salário regular e os consertos eventuais» (correta) e «Contar com consertos todo mês» (tentadora).",
        kind: "application",
        skills: [0],
        visual: null,
        visualKind: "none",
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
  "pt-usuarios-contabilidade-beginner": {
    canDo: "Identificar usuários da informação contábil e suas decisões",
    description:
      "A contabilidade fornece informações que diferentes usuários empregam para tomar decisões sobre uma organização.",
    estimatedMinutes: 5,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Fábio administra uma empresa e conversa com uma representante de um banco sobre um empréstimo. Os dois olham informações sobre a empresa: por que cada um se interessa por elas?",
        kind: "hook",
        skills: [],
        visual:
          "Fábio e uma representante de banco conversam diante de documentos sobre a empresa.",
        visualKind: "picture",
      },
      {
        activityTemplate: null,
        brief:
          "Explique que a contabilidade registra e organiza informações sobre a situação e as atividades de uma organização. Por exemplo, ela reúne dados sobre bens, dívidas e dinheiro que entra e sai.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Apresente usuários da informação contábil como pessoas ou organizações que a utilizam. Um proprietário pode consultar entradas e saídas de dinheiro ao decidir se amplia as atividades da empresa.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Fábio é proprietário e quer decidir se amplia sua empresa. Pergunte quais informações contábeis podem ajudá-lo; inclua como alternativa tentadora a cor preferida dos clientes.",
        kind: "check",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Explique que um credor é quem tem dinheiro a receber de uma organização ou considera emprestar a ela. Um banco pode examinar dívidas e entradas de dinheiro antes de decidir se concede um empréstimo.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Mostre que órgãos do governo também usam informações contábeis. Uma autoridade fiscal pode examiná-las para verificar se a empresa cumpriu obrigações tributárias.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: "matchPairs",
        brief:
          "Peça para associar cada usuário à decisão descrita: proprietário à ampliação da própria empresa; banco à concessão de um empréstimo; autoridade fiscal à verificação de obrigações tributárias. Inclua a troca entre banco e autoridade fiscal como erro tentador e explique que os usuários podem se interessar por informações semelhantes, embora tomem decisões diferentes.",
        kind: "activity",
        skills: [0],
        visual: null,
        visualKind: "template",
      },
      {
        activityTemplate: null,
        brief:
          "Apresente outros usuários: investidores podem avaliar se aplicam dinheiro na empresa, e trabalhadores podem observar sua situação ao decidir se permanecem nela. Ambos podem consultar informações contábeis para apoiar essas escolhas.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Explique que a mesma informação pode interessar a mais de um usuário. Por exemplo, as dívidas da empresa podem ajudar tanto um banco a avaliar um empréstimo quanto um investidor a avaliar uma aplicação.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Uma empresa informa que suas dívidas aumentaram. Pergunte quem pode usar essa informação ao decidir sobre a empresa: um banco, um investidor ou ambos; inclua a ideia tentadora de que cada informação serve a um único usuário.",
        kind: "check",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Fábio considera ampliar sua empresa enquanto um banco avalia emprestar dinheiro a ela; há registros de entradas, saídas e dívidas. Peça para escolher a combinação de decisões que esses dados podem apoiar para os dois usuários, incluindo como alternativa tentadora a verificação de tributos pelo banco.",
        kind: "application",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
    ],
    skills: [
      {
        description:
          "Reconhecer diferentes usuários das informações contábeis e as decisões que elas podem apoiar.",
        example:
          "Um banco consulta as dívidas de uma empresa antes de decidir sobre um empréstimo.",
        hard: false,
        name: "Identificar usuários da informação contábil",
        topic: "Usuários da informação contábil",
        useCase:
          "Entender quem consulta informações de uma organização e para tomar quais decisões.",
      },
    ],
    supportMode: "explanationFirst",
    title: "Usuários e finalidade da contabilidade",
  },
} as const satisfies Record<string, LessonSpec>;
