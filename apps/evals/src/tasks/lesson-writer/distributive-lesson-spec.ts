import { type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";
import { type WriteLessonDraftParams } from "@zoonk/ai/tasks/lesson-writer";

/**
 * A production lesson plan (8 Nov 2026). Screen 2 gives a generic example (80 of 100 new places to
 * high income), and screen 11 resolves the hook's program (40 to 100 places, all 60 new ones to
 * high income); the writer told screen 2 as the hook's program with 45 of 60.
 */
export const DISTRIBUTIVE_LESSON: Pick<
  WriteLessonDraftParams,
  "chapterLessons" | "chapterTitle" | "courseTitle" | "exams" | "language" | "level"
> & { spec: LessonSpec } = {
  chapterLessons: [
    {
      canDo: "Analisar desigualdades de raça, gênero e classe em conjunto",
      order: "before",
      title: "Interseccionalidade das desigualdades",
    },
    {
      canDo: "Analisar como o território condiciona o acesso a oportunidades",
      examples: [
        "Igor conseguiu uma vaga num curso gratuito no centro de Santarém. A aula termina às 22h, mas o último ônibus para o bairro dele sai às 21h30. Se a vaga é dele, por que ele não consegue aproveitá-la?",
        "Duas regiões recebem 200 novas vagas de formação cada. Uma tem 20 mil habitantes, e a outra tem 80 mil. Em qual delas a oferta por habitante cresce mais?",
        "Cada região ganhou 200 vagas. Quantas vagas por mil habitantes?",
        "A região A tem 300 vagas de formação para 30 mil habitantes. A região B tem 150 vagas para 15 mil habitantes. Julgue o item: a região A tem maior oferta proporcional de vagas que a região B.",
        "No distrito de Lagoa Seca, sobram vagas de consulta no posto de saúde, que atende até as 16h. O único ônibus do distrito chega ao posto às 16h30. Julgue o item: ampliar o número de vagas de consulta elimina a barreira enfrentada pelos moradores.",
        "Um relatório informa que 85% dos domicílios de uma cidade têm água encanada. Com base nisso, conclui que todos os bairros da cidade superam 80%. Julgue a conclusão do relatório.",
      ],
      ideas: [
        "Desigualdades territoriais são diferenças de condições ligadas ao lugar onde se vive.",
        "Para comparar a oferta entre territórios, é preciso considerar a população atendida, como em vagas por mil habitantes.",
        "Acessibilidade é a chance real de alcançar e usar um serviço, e uma vaga sem um jeito de chegar existe mas não serve.",
        "A desigualdade inter-regional ocorre entre regiões, e a desigualdade intraurbana ocorre dentro da mesma cidade.",
        "Uma média municipal não diz quanto tem cada bairro e pode esconder bairros muito abaixo dela.",
      ],
      order: "before",
      title: "Desigualdades territoriais",
    },
    {
      canDo: "Distinguir desigualdade de resultados e de oportunidades",
      order: "before",
      title: "Oportunidades e resultados desiguais",
    },
    {
      canDo: "Tomar decisões com as habilidades deste capítulo",
      order: "after",
      title: "Desafio: Desigualdades e distribuição de oportunidades",
    },
  ],
  chapterTitle: "Desigualdades e distribuição de oportunidades",
  courseTitle: "Administração Pública",
  exams: [
    {
      name: "Concurso CGU",
      style:
        "trueFalse: Itens para julgamento individual como Certo ou Errado. essay: Questão discursiva relacionada a conhecimentos complementares a ser respondida em até 30 linhas. essay: Questão discursiva envolvendo situação-problema relacionada a conhecimentos específicos a ser respondida em até 60 linhas.",
    },
  ],
  language: "pt",
  level: "intermediate",
  spec: {
    canDo: "Avaliar quem ganha e quem fica excluído de políticas públicas",
    description:
      "Analisar a distribuição de benefícios, custos e acesso para avaliar se uma política reduz ou reforça desigualdades.",
    estimatedMinutes: 5,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Um programa de cursos gratuitos dobrou suas vagas, mas o atendimento às famílias de baixa renda não aumentou. Como uma expansão pode deixar justamente esse grupo para trás?",
        kind: "hook",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "O efeito distributivo mostra como benefícios e custos se repartem entre grupos: de 100 novas vagas gratuitas, por exemplo, 80 podem chegar a pessoas de renda alta.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Dois grupos têm rendas mensais por pessoa de R$ 1.000 e R$ 5.000; todos receberão R$ 100. A distância proporcional entre as rendas vai diminuir, ficar igual ou aumentar? Resposta: diminuir.",
        kind: "guess",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Mostrar em etapas: R$ 100 ÷ R$ 1.000 = 10%; R$ 100 ÷ R$ 5.000 = 2%. A transferência é progressiva porque aumenta proporcionalmente mais a renda de quem tem menos.",
        kind: "workedExample",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Julgar: receber R$ 200 sobre renda de R$ 1.000 é proporcionalmente menos vantajoso que receber R$ 500 sobre R$ 5.000. Errado: são 20% contra 10%; a armadilha é comparar apenas os valores recebidos.",
        kind: "check",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Uma transferência progressiva pode manter a diferença absoluta, medida em reais: ela continua em R$ 4.000 neste caso. Tabela de renda mensal por pessoa: menor renda, R$ 1.000 antes e R$ 1.100 depois; maior renda, R$ 5.000 antes e R$ 5.100 depois.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "table",
      },
      {
        activityTemplate: null,
        brief:
          "O benefício líquido desconta do benefício recebido o custo suportado para financiar a política. Quem recebe R$ 200, mas paga R$ 250 adicionais no seu financiamento, fica com R$ 200 − R$ 250 = −R$ 50.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Tabela mensal por pessoa, com colunas renda, benefício e custo adicional: R$ 1.000 | R$ 200 | R$ 150; R$ 5.000 | R$ 400 | R$ 100. Julgar se o ganho líquido proporcional favorece a menor renda: Errado, são 5% contra 6%; a armadilha é ignorar o financiamento.",
        kind: "check",
        skills: [0],
        visual: null,
        visualKind: "table",
      },
      {
        activityTemplate: null,
        brief:
          "A elegibilidade, isto é, cumprir os critérios para receber, não garante acesso efetivo. Um auxílio com inscrição apenas por aplicativo pode excluir pessoas que têm direito, mas não têm internet.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Um auxílio exclusivo para famílias de baixa renda exige conta bancária, que parte delas não possui. Julgar: o critério de renda basta para assegurar atendimento a todo o público previsto; Errado, pois o pagamento cria uma barreira de acesso.",
        kind: "check",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "O crescimento total pode esconder a concentração dos novos benefícios: as vagas ocupadas passaram de 40 para 100, sem avanço na baixa renda. Mostrar barras por grupo, antes/depois: baixa renda, 20/20; renda alta, 20/80.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "chart",
      },
      {
        activityTemplate: null,
        brief:
          "Um auxílio exige aplicativo; tabela mensal por pessoa, com renda | recebem/elegíveis | auxílio | custo adicional: R$ 1.000 | 40/100 | R$ 300 | R$ 100; R$ 5.000 | 100/100 | R$ 300 | R$ 0. Pedir uma conclusão técnica e uma mudança de acesso: o ganho líquido entre recebedores é 20% contra 6%, mas a cobertura é 40% contra 100%; propor inscrição presencial, rejeitando que valores iguais garantam efeitos iguais.",
        kind: "application",
        skills: [0],
        visual: null,
        visualKind: "table",
      },
    ],
    skills: [
      {
        description:
          "Analisar quem recebe benefícios, quem suporta os custos e quem encontra barreiras de acesso para avaliar a distribuição dos efeitos de uma política.",
        example:
          "Um auxílio de R$ 100 representa 10% de uma renda de R$ 1.000 e 2% de uma renda de R$ 5.000.",
        hard: true,
        name: "Avaliar efeitos distributivos de políticas",
        topic: "Avaliar efeitos distributivos de políticas",
        useCase:
          "Examinar programas públicos sem confundir expansão do atendimento com redução das desigualdades.",
      },
    ],
    title: "Efeitos distributivos das políticas",
  },
};
