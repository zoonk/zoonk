import { type LessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec/rules";
import { type WriteLessonDraftParams } from "@zoonk/ai/tasks/v2/lesson-writer";

type WalkLesson = Pick<
  WriteLessonDraftParams,
  "chapterTitle" | "courseTitle" | "exams" | "language" | "level"
> & { spec: LessonSpec };

/** The ENEM as its goals' shared lessons read it: the notice's formats and scoring (`toItemExam`). */
const ENEM_EXAM = {
  name: "ENEM",
  style:
    "multipleChoice (5 options): Múltipla escolha com cinco alternativas, de A a E essay: Redação dissertativo-argumentativa de até 30 linhas Teoria de Resposta ao Item: um acerto vale mais quando o padrão de respostas é coerente.",
};

/**
 * Shared lessons of Lucas's ENEM goal that persona walks found flawed (Oct 2026), with the plan the
 * writer read: the stored plan when the lesson still exists, else one rebuilt from the screens the
 * walk recorded.
 */
export const WALK_LESSONS: Record<"pt-piramide-energia" | "pt-precisao-sensores", WalkLesson> = {
  /**
   * The stored plan (9 Oct 2026). Its guess reveals 10 units after 1.000, 120 and 14, a 71% share
   * the lesson's own 12% and 14% contradict, and the writer marked it right.
   */
  "pt-piramide-energia": {
    chapterTitle: "Relações ecológicas e ciclos da matéria",
    courseTitle: "Ciências da Natureza",
    exams: [ENEM_EXAM],
    language: "pt",
    level: "intermediate",
    spec: {
      canDo: "Explicar por que menos energia chega a cada nível trófico.",
      description:
        "Mostra como a energia entra pelos produtores, diminui nas transferências alimentares e aparece na pirâmide de energia.",
      estimatedMinutes: 4,
      screens: [
        {
          activityTemplate: null,
          brief:
            "Em Macapá, Nayara registra 1.000 unidades de energia nas algas, 120 nos crustáceos que as comem e 14 nos peixes que comem os crustáceos. Mostre esses valores em um gráfico de barras e pergunte: se a energia continuar diminuindo, qual valor poderia aparecer no grupo que come esses peixes? Opções: 10, 120, 140, 1.000 ou 1.140 unidades; revele 10 assim que você escolher, sem explicar o motivo ainda.",
          kind: "hook",
          skills: [0],
          visual: null,
        },
        {
          activityTemplate: null,
          brief:
            "Mostre que a luz do Sol é a principal entrada de energia nessa sequência: as algas usam parte dela para produzir alimento, no qual fica energia disponível para outros seres vivos. Use a comparação com carregar uma bateria: nem toda a luz recebida fica guardada.",
          kind: "explanation",
          skills: [0],
          visual: null,
        },
        {
          activityTemplate: null,
          brief:
            "Explique a respiração celular como o uso do alimento pelo organismo para manter o corpo funcionando, semelhante a um motor que usa combustível e libera calor. Além dessa energia liberada, partes que não são comidas não passam ao consumidor seguinte daquele caminho.",
          kind: "explanation",
          skills: [0],
          visual: null,
        },
        {
          activityTemplate: null,
          brief:
            "Renan, em Maringá, afirma que a energia diminui entre um grupo e outro porque é destruída durante a respiração celular. Peça que você avalie a afirmação e escolha a correção: parte da energia é liberada ao ambiente como calor; inclua como alternativa tentadora que toda a energia do alimento passa intacta ao próximo consumidor.",
          kind: "check",
          skills: [0],
          visual: null,
        },
        {
          activityTemplate: null,
          brief:
            "Apresente a pirâmide de energia como uma forma de comparar a energia disponível em cada nível trófico: sua base é maior porque a cada transferência chega menos energia ao grupo seguinte. Mostre um gráfico de barras com plantas: 900 unidades; insetos que as comem: 108; aves que comem os insetos: 15.",
          kind: "explanation",
          skills: [0],
          visual: null,
        },
        {
          activityTemplate: null,
          brief:
            "Esclareça que a diminuição não segue uma porcentagem obrigatória: quanto fica disponível ao próximo grupo depende, entre outras coisas, do alimento consumido e da energia usada pelos organismos. Portanto, não se deve aplicar automaticamente uma regra de transferência de 10% a toda sequência.",
          kind: "explanation",
          skills: [0],
          visual: null,
        },
        {
          activityTemplate: "categorize",
          brief:
            "Em uma sequência de taboas → caramujos → marrecos, peça que você separe os destinos da energia em «pode chegar ao próximo consumidor desse caminho» e «não chega ao próximo consumidor desse caminho». Use como itens: energia no corpo de caramujos comidos pelos marrecos; energia nas partes das taboas comidas pelos caramujos; calor liberado pelos caramujos; energia nas partes das taboas que nenhum caramujo come. A distinção importante é que algo não consumido nesse caminho não desaparece.",
          kind: "activity",
          skills: [0],
          visual: null,
        },
        {
          activityTemplate: null,
          brief:
            "Em Petrolina, Jussara avalia um açude com plantas aquáticas, moluscos que as comem, peixes pequenos que comem os moluscos e peixes predadores que comem os peixes pequenos. Mostre um gráfico de barras com 12.000, 1.600, 180 e 21 unidades de energia nesses grupos, respectivamente. Para obter mais energia na pesca a partir da mesma base de plantas, peça que você escolha entre capturar peixes pequenos ou predadores e justifique usando os dados e a perda de energia nas transferências; inclua a opção tentadora de escolher predadores por estarem no topo da sequência.",
          kind: "application",
          skills: [0],
          visual: null,
        },
      ],
      skills: [
        {
          description:
            "A cada transferência alimentar, parte da energia não chega ao consumidor seguinte, por isso a energia disponível diminui nos níveis tróficos.",
          example:
            "De 900 unidades de energia nas plantas, 108 ficam disponíveis nos insetos e 15 nas aves que os comem.",
          hard: false,
          name: "Explicar a diminuição de energia entre níveis tróficos",
          topic: "Fluxo de energia",
          useCase:
            "Interpretar dados de energia em uma sequência alimentar e comparar grupos de organismos.",
        },
      ],
      supportMode: "explanationFirst",
      title: "Fluxo de energia e pirâmides tróficas",
    },
  },
  /**
   * Rebuilt from the screens the walk recorded (8 Oct 2026; the lesson was deleted since). Its
   * guess listed sensors A to E in a table and offered A to D, so sensor E couldn't be picked.
   */
  "pt-precisao-sensores": {
    chapterTitle: "Grandezas e representações físicas",
    courseTitle: "Ciências da Natureza",
    exams: [ENEM_EXAM],
    language: "pt",
    level: "intermediate",
    spec: {
      canDo: "Distinguir precisão de exatidão e estimar a incerteza de leituras repetidas",
      description:
        "Mostra como avaliar separadamente o agrupamento das leituras e a proximidade da referência, e como comunicar uma medida com sua margem.",
      estimatedMinutes: 5,
      screens: [
        {
          activityTemplate: null,
          brief:
            "Renan mede uma peça cuja referência é 50,0 mm. Mostre numa tabela três leituras de cada um de cinco sensores: A: 49,8; 49,9; 50,0 mm; B: 51,0; 51,0; 51,1 mm; C: 48,0; 50,0; 52,0 mm; D: 49,0; 50,0; 51,0 mm; E: 50,4; 50,6; 50,8 mm. Pergunte qual sensor dá leituras agrupadas e perto da referência. Revele A assim que você escolher, sem explicar o motivo ainda.",
          kind: "hook",
          skills: [],
          visual: null,
        },
        {
          activityTemplate: null,
          brief:
            "Com referência de 20,0 cm, o grupo X leu 22,0; 22,1; 22,2 cm e o grupo Y leu 19,0; 20,0; 21,0 cm. Mostre as leituras numa tabela e pergunte qual grupo tem leituras mais agrupadas, mesmo longe da referência. Resposta: X; inclua como alternativa tentadora escolher Y por estar perto da referência.",
          kind: "check",
          skills: [0],
          visual: null,
        },
        {
          activityTemplate: null,
          brief:
            "Apresente a precisão como o agrupamento das leituras: quanto mais próximas umas das outras, maior a precisão. Use X e Y do caso anterior e deixe claro que a precisão sozinha não diz se o resultado está perto da referência.",
          kind: "explanation",
          skills: [0],
          visual: null,
        },
        {
          activityTemplate: null,
          brief:
            "Apresente a exatidão como a proximidade do resultado central à referência: Y se distribui em torno de 20,0 cm, e X se agrupa em torno de 22,1 cm. Mostre que agrupar leituras e acertar o alvo são avaliações diferentes.",
          kind: "explanation",
          skills: [0],
          visual: null,
        },
        {
          activityTemplate: null,
          brief:
            "Com referência de 100,0 g, o sensor C leu 98,0; 100,0; 102,0 g e o sensor D leu 103,0; 103,1; 103,2 g. Pergunte qual sensor repete quase o mesmo resultado, mas exige investigar seu desvio da referência. Resposta: D; inclua como alternativa tentadora escolher C por ter uma leitura igual à referência.",
          kind: "check",
          skills: [0],
          visual: null,
        },
        {
          activityTemplate: null,
          brief:
            "Apresente a incerteza como a margem que comunica a variação observada: com leituras de 8,0; 8,2; 8,4 cm, o meio entre os extremos é 8,2 cm e metade da distância entre eles é 0,2 cm, então a estimativa é 8,2 ± 0,2 cm. Esclareça que essa margem não garante que a referência esteja dentro dela.",
          kind: "explanation",
          skills: [1],
          visual: null,
        },
        {
          activityTemplate: null,
          brief:
            "Jussara mede uma peça três vezes e obtém 18,6; 18,8; 19,0 mm. Mostre passo a passo o meio entre a menor e a maior leitura (18,8 mm), a distância entre os extremos (0,4 mm) e metade dela como margem (0,2 mm), chegando a 18,8 ± 0,2 mm.",
          kind: "workedExample",
          skills: [1],
          visual: null,
        },
        {
          activityTemplate: null,
          brief:
            "Dê três leituras da mesma medida, 11,7; 11,9; 12,1 cm, e peça o resultado central com a margem pelo procedimento de Jussara. Resposta: 11,9 ± 0,2 cm; inclua como alternativa tentadora 11,9 ± 0,4 cm, que usa a distância inteira entre os extremos como margem.",
          kind: "check",
          skills: [1],
          visual: null,
        },
        {
          activityTemplate: null,
          brief:
            "Kauã estima a incerteza de 31,6; 32,0; 32,4 °C em quatro passos: o meio dos extremos é 32,0 °C; a distância entre eles é 0,4 °C; a metade é 0,2 °C; o resultado é 32,0 ± 0,2 °C. Peça que você encontre o primeiro passo errado: a distância é 0,8 °C, então o resultado é 32,0 ± 0,4 °C; inclua como alternativa tentadora apontar o último passo.",
          kind: "check",
          skills: [1],
          visual: null,
        },
        {
          activityTemplate: null,
          brief:
            "Na Termolab, em Joinville, Tainá escolhe um sensor para peças de referência 50,0 mm: o resultado central deve ficar a no máximo 0,2 mm dela, e a margem estimada deve ser de no máximo 0,2 mm. Mostre numa tabela as leituras do sensor A (49,5; 49,6; 49,7 mm) e do sensor B (49,8; 50,0; 50,2 mm) e peça que você escolha o sensor que atende às duas condições, com os resultados aproximados de A e B. Resposta: B (A: 49,6 ± 0,1 mm; B: 50,0 ± 0,2 mm); inclua como alternativa tentadora escolher A por ter a menor margem.",
          kind: "application",
          skills: [0, 1],
          visual: null,
        },
      ],
      skills: [
        {
          description:
            "Distinguir o agrupamento de leituras repetidas (precisão) da proximidade do resultado à referência (exatidão).",
          example:
            "Leituras de 22,0; 22,1; 22,2 cm são precisas, mas pouco exatas quando a referência é 20,0 cm.",
          hard: false,
          name: "Distinguir precisão de exatidão",
          topic: "Precisão e exatidão",
          useCase: "Escolher um instrumento de medida ou avaliar um resultado de laboratório.",
        },
        {
          description:
            "Comunicar uma medida pelo meio entre as leituras extremas, com metade da distância entre elas como margem.",
          example: "Leituras de 18,6; 18,8; 19,0 mm dão 18,8 ± 0,2 mm.",
          hard: true,
          name: "Estimar a incerteza de leituras repetidas",
          topic: "Incerteza de medição",
          useCase: "Comunicar o resultado de uma medição feita várias vezes.",
        },
      ],
      supportMode: "questionFirst",
      title: "Precisão, exatidão e incerteza",
    },
  },
};
