import { type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";

/** Beginner plans the planner wrote for a household budget course, as stored. */
export const BUDGET_LESSON_SPECS = {
  "pt-fontes-datas-renda-beginner": {
    canDo: "Mapear fontes e datas de recebimento",
    description:
      "Organizar as entradas da casa por fonte, valor e data para saber quando contar com cada uma.",
    estimatedMinutes: 4,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Nayara olha as contas que vencem na próxima semana. Ela recebe pelo emprego e por um trabalho extra, mas o dinheiro não chega todo junto. Como saber com o que poderá contar?",
        kind: "hook",
        skills: [],
        visual:
          "Nayara à mesa de casa, olhando contas de papel e segurando um celular, com expressão preocupada.",
        visualKind: "picture",
      },
      {
        activityTemplate: null,
        brief:
          "Nayara anota de onde vem o dinheiro: R$ 2.000,00 do emprego e R$ 600,00 de um serviço. Cada origem é uma fonte de renda; outro exemplo é uma aposentadoria. Mostre as duas entradas em uma tabela com fonte e valor disponível.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "table",
      },
      {
        activityTemplate: null,
        brief:
          "O salário de Nayara está previsto para o dia 20 e o pagamento pelo serviço, para o dia 5. Se ambos chegarem como previsto e ela não tiver outro dinheiro guardado, com quanto dessas entradas ela poderá contar no dia 10? Opções: R$ 2.600,00; R$ 2.000,00; R$ 600,00. Correta: R$ 600,00.",
        kind: "guess",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "No dia 10, Nayara só terá recebido os R$ 600,00 do serviço: a data de recebimento mostra quando uma entrada é esperada. É como uma entrega: não basta saber o que virá, importa quando chegará. A data prevista pode mudar, então não é uma garantia. Mostre serviço: R$ 600,00, dia 5; emprego: R$ 2.000,00, dia 20.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "table",
      },
      {
        activityTemplate: null,
        brief:
          "Mostre Nayara montando o mapa de setembro: anote cada fonte, o valor disponível e a data prevista; depois, coloque as entradas em ordem de data. Tabela final: serviço, R$ 600,00, 05/09; emprego, R$ 2.000,00, 20/09.",
        kind: "workedExample",
        skills: [0],
        visual: null,
        visualKind: "table",
      },
      {
        activityTemplate: null,
        brief:
          "Peça para montar um mapa em ordem de data com emprego, R$ 1.700,00 em 18/10, e serviço, R$ 350,00 em 07/10. A resposta correta liga cada fonte a seu valor e sua data; inclua como erro tentador trocar as datas das duas fontes.",
        kind: "check",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Nayara combina outro serviço por R$ 150,00, mas ainda não sabe quando receberá. Ela registra a entrada com a data «a confirmar», sem inventar um dia. Exemplo: um aluguel a receber também pode ficar com a data a confirmar.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Um serviço de R$ 280,00 está combinado, mas o cliente ainda não informou a data de pagamento. Pergunte como registrá-lo: fonte e valor com data a confirmar. Inclua como erro tentador escolher o dia em que o serviço será feito.",
        kind: "check",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Nayara prepara o mapa de outubro: emprego, R$ 2.000,00 em 20/10; serviço de revisão, R$ 600,00 em 05/10; outro serviço, R$ 150,00 com data a confirmar. Peça que escolha o mapa correto e identifique com quais entradas pode contar até 10/10 se as datas previstas forem cumpridas e não houver atraso; inclua como erro tentador contar também o serviço sem data confirmada.",
        kind: "application",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
    ],
    skills: [
      {
        description:
          "Organizar cada entrada pelo valor disponível e pela data prevista, sinalizando datas ainda desconhecidas.",
        example: "Registrar salário de R$ 2.000,00 no dia 20 e serviço de R$ 600,00 no dia 5.",
        hard: true,
        name: "Mapear rendas e datas de recebimento",
        topic: "Fontes e datas de renda",
        useCase: "Saber quais entradas da casa estão previstas antes do vencimento de uma conta.",
      },
    ],
    title: "Fontes e datas de renda",
  },
  "pt-registros-financeiros-beginner": {
    canDo: "Reunir registros das movimentações financeiras da casa",
    description:
      "Como reunir extratos, faturas e comprovantes para levantar as movimentações da casa sem contar gastos duas vezes.",
    estimatedMinutes: 5,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Kauã abre o aplicativo do banco para descobrir quanto a casa gastou no mês. Ao lado dele há recibos de compras e um cartão de crédito. Será que o aplicativo mostra tudo?",
        kind: "hook",
        skills: [],
        visual:
          "Kauã à mesa, olhando o aplicativo do banco no celular, com recibos de compras e um cartão de crédito ao lado.",
        visualKind: "picture",
      },
      {
        activityTemplate: null,
        brief:
          "Kauã consulta o extrato: como um histórico de mensagens, ele reúne registros em ordem de data. O extrato mostra entradas e saídas de uma conta no período escolhido, não de outras contas. Exemplo: tabela com 03/04, recebimento, R$ 1.800,00; 05/04, Pix enviado, R$ 60,00.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "table",
      },
      {
        activityTemplate: null,
        brief:
          "Kauã procura no extrato da conta uma compra que fez no mês. Qual destas ele pode não encontrar ali ainda? Opções: compra no cartão de crédito ainda não paga; Pix já debitado; saque já debitado. Resposta: compra no cartão de crédito ainda não paga.",
        kind: "guess",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Kauã encontra a compra na fatura, a lista de cobranças do cartão de crédito; o pagamento da fatura aparece no extrato quando sai da conta. Para levantar gastos, não conte a compra e o pagamento da mesma fatura como dois gastos. Exemplo: fatura com compra de R$ 80,00; extrato com pagamento dessa fatura de R$ 80,00.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "table",
      },
      {
        activityTemplate: null,
        brief:
          "Uma compra de R$ 45,00 aparece na fatura do cartão, e o pagamento dessa mesma fatura aparece no extrato. Ao levantar os gastos, pergunte se isso representa um ou dois gastos; inclua como erro tentador contar dois.",
        kind: "check",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Kauã acha o comprovante de um Pix: esse registro confirma uma operação específica e mostra dados como data, valor e destinatário. Um boleto ainda não pago não comprova pagamento; por exemplo, guarde o comprovante depois de pagar a conta de internet.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Kauã lembra de uma compra paga em dinheiro, que não aparece no extrato da conta. Ele guarda o recibo ou, se não o tiver, anota data, valor e compra. Exemplo: 08/04, pão, R$ 12,00.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Mostre Kauã reunindo abril passo a passo: escolhe o período; busca o extrato da conta e a fatura do cartão; acrescenta o recibo da compra em dinheiro. Na tabela, registre extrato: recebimento de R$ 1.800,00; fatura: compra de R$ 80,00; recibo: pão de R$ 12,00; marque o pagamento da fatura no extrato como ligado à compra, não como outro gasto.",
        kind: "workedExample",
        skills: [0],
        visual: null,
        visualKind: "table",
      },
      {
        activityTemplate: null,
        brief:
          "Uma casa usou uma conta, um cartão de crédito e dinheiro vivo no mês. Peça a seleção do conjunto de registros para levantar as movimentações: extrato, fatura e recibos ou anotações em dinheiro; inclua como erro tentador levar apenas o extrato e o comprovante de pagamento da fatura.",
        kind: "check",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Kauã encontra uma transferência entre duas contas da própria casa: ela aparece como saída em uma e entrada na outra, mas não é uma nova renda nem um gasto da casa. Exemplo na tabela: conta A, saída de R$ 100,00; conta B, entrada dos mesmos R$ 100,00.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "table",
      },
      {
        activityTemplate: "matchPairs",
        brief:
          "Peça para associar cada necessidade ao registro mais direto: movimentos de uma conta ao extrato; compras no crédito à fatura; confirmação de um Pix específico ao comprovante; compra em dinheiro sem recibo à anotação. Inclua boleto ainda não pago como distrator de comprovante e explique que ele não confirma o pagamento.",
        kind: "activity",
        skills: [0],
        visual: null,
        visualKind: "template",
      },
      {
        activityTemplate: null,
        brief:
          "Kauã reuniu o extrato de uma conta, a fatura paga e um recibo em dinheiro. Ele também transferiu dinheiro para outra conta da casa. Peça que escolha o que falta reunir e o que não deve contar como novo gasto ou renda: falta o extrato da outra conta; a transferência é interna e o pagamento da fatura não é outro gasto de compra. Inclua como erro considerar a transferência uma nova renda e dispensar o segundo extrato.",
        kind: "application",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
    ],
    skills: [
      {
        description:
          "Reunir registros de contas, cartões e pagamentos em dinheiro para levantar as movimentações da casa sem duplicar gastos.",
        example: "Juntar o extrato de abril, a fatura do cartão e um recibo de compra em dinheiro.",
        hard: true,
        name: "Reunir registros financeiros domésticos",
        topic: "Registros financeiros domésticos",
        useCase: "Levantar o dinheiro que entrou e os gastos da casa no mês.",
      },
    ],
    title: "Registros financeiros domésticos",
  },
  "pt-renda-bruta-liquida-beginner": {
    canDo: "Identificar a renda líquida disponível para uso",
    description:
      "Entenda a diferença entre valores brutos e líquidos no salário e no trabalho por conta própria.",
    estimatedMinutes: 5,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Otávio recebe uma proposta de trabalho e fica animado com o valor anunciado. Ao olhar o pagamento que cairia na conta, ele percebe que é menor. Por que os dois valores são diferentes?",
        kind: "hook",
        skills: [],
        visual:
          "Otávio em casa, olhando a proposta de trabalho e a tela do celular com expressão de surpresa, sem valores legíveis.",
        visualKind: "picture",
      },
      {
        activityTemplate: null,
        brief:
          "Otávio confere a proposta: o salário anunciado é R$ 3.000,00 antes de qualquer retirada do pagamento. Esse valor inicial é o salário bruto. Exemplo: uma proposta de R$ 2.000,00 também mostra o bruto antes de descontos.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Otávio compara duas propostas com salário bruto igual: uma retém R$ 300,00 do pagamento e a outra não retém nada. Qual deixará mais dinheiro para ele usar ao receber? Opções: 'A que retém R$ 300,00'; 'A que não retém nada'; 'As duas deixam o mesmo valor'. Correta: 'A que não retém nada'.",
        kind: "guess",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: "formulaModel",
        brief:
          "Otávio descobre que o valor que chega após as retiradas é a renda líquida. É como uma caixa de dinheiro da qual se tiram valores antes da entrega; gastos pagos depois não são essas retiradas. Mostre o modelo líquido = bruto − descontos, com bruto de R$ 2.000,00 a R$ 4.000,00 e descontos de R$ 0,00 a R$ 500,00, em passos de R$ 100,00; início em R$ 3.000,00 e R$ 300,00, resultado R$ 2.700,00.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "template",
      },
      {
        activityTemplate: null,
        brief:
          "No pagamento de Otávio, acompanhe as contas: salário bruto de R$ 3.000,00, desconto de INSS de R$ 270,00 e outro desconto de R$ 30,00. Some os descontos, R$ 300,00, e subtraia do bruto para chegar ao líquido de R$ 2.700,00. Mostre esses valores em uma tabela.",
        kind: "workedExample",
        skills: [0],
        visual: null,
        visualKind: "table",
      },
      {
        activityTemplate: null,
        brief:
          "Peça o líquido de um salário bruto de R$ 2.400,00 com desconto total de R$ 200,00: R$ 2.200,00. Inclua R$ 2.400,00 como erro tentador de usar o bruto.",
        kind: "check",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Otávio nota que, sem descontos, o valor recebido seria igual ao bruto. Uma conta de luz paga depois não muda o salário líquido, embora diminua o dinheiro restante. Exemplo: de R$ 2.000,00 líquidos, pagar R$ 150,00 deixa R$ 1.850,00.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: "formulaModel",
        brief:
          "No modelo líquido = bruto − descontos, use controles de R$ 2.000,00 a R$ 4.000,00 para o bruto e de R$ 0,00 a R$ 500,00 para os descontos, em passos de R$ 100,00. Peça que a pessoa ajuste o bruto para R$ 2.400,00 e os descontos para R$ 0,00 e informe o líquido: R$ 2.400,00; trate R$ 0,00 como a confusão entre ausência de desconto e ausência de renda.",
        kind: "activity",
        skills: [0],
        visual: null,
        visualKind: "template",
      },
      {
        activityTemplate: null,
        brief:
          "Otávio também considera fazer serviços por conta própria. O faturamento bruto é o total cobrado pelas vendas ou serviços, antes dos gastos do trabalho e impostos. Exemplo: de R$ 1.000,00 recebidos, após R$ 200,00 de materiais e R$ 100,00 de impostos, sobram R$ 700,00.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "table",
      },
      {
        activityTemplate: null,
        brief:
          "Um serviço trouxe R$ 2.500,00, com R$ 400,00 de materiais e R$ 100,00 de impostos. Peça o valor que sobra após esses gastos: R$ 2.000,00; inclua R$ 2.100,00 como erro de esquecer o imposto.",
        kind: "check",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Otávio recebeu salário bruto de R$ 3.000,00, com R$ 300,00 de descontos, e R$ 2.000,00 por serviços, com R$ 500,00 de materiais e R$ 100,00 de impostos. Qual o total disponível antes das contas da casa? Resposta: R$ 4.100,00; inclua R$ 5.000,00 como erro de somar os valores brutos.",
        kind: "application",
        skills: [0],
        visual: null,
        visualKind: "table",
      },
    ],
    skills: [
      {
        description:
          "Separar o valor inicial dos descontos e gastos necessários para identificar quanto sobra para uso.",
        example:
          "Um salário bruto de R$ 2.400,00 com R$ 200,00 em descontos deixa R$ 2.200,00 líquidos.",
        hard: true,
        name: "Distinguir renda bruta e líquida",
        topic: "Renda bruta e líquida",
        useCase:
          "Saber quanto do salário ou dos serviços prestados está disponível para as contas da casa.",
      },
    ],
    title: "Renda bruta e renda líquida",
  },
} as const satisfies Record<string, LessonSpec>;
