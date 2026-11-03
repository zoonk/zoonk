import { type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";
import { type WriteLessonDraftParams } from "@zoonk/ai/tasks/lesson-writer";

type WalkLesson = Pick<
  WriteLessonDraftParams,
  "chapterTitle" | "courseTitle" | "exams" | "language" | "level"
> & { spec: LessonSpec };

const ENEM_EXAM = {
  name: "ENEM",
  style:
    "multipleChoice (5 options): Múltipla escolha com cinco alternativas, de A a E essay: Redação dissertativo-argumentativa de até 30 linhas Teoria de Resposta ao Item: um acerto vale mais quando o padrão de respostas é coerente.",
};

export const WALK_LESSONS: Record<
  "pt-grupos-de-animais" | "pt-piramide-energia" | "pt-precisao-sensores",
  WalkLesson
> = {
  "pt-grupos-de-animais": {
    chapterTitle: "Dados de biodiversidade e classificação",
    courseTitle: "ENEM",
    exams: [ENEM_EXAM],
    language: "pt",
    level: "intermediate",
    spec: {
      canDo: "Distinguir grupos animais por traços do corpo, não pelo habitat",
      description:
        "Compara simetria, sustentação e estruturas do corpo para distinguir grandes grupos animais em registros de biodiversidade.",
      estimatedMinutes: 5,
      screens: [
        {
          activityTemplate: null,
          brief:
            "Edson encontrou um caranguejo no litoral. Pergunte com qual animal ele deve agrupá-lo pelos traços do corpo: A) caracol-marinho, B) camarão, C) estrela-do-mar, D) peixe, E) água-viva. Revele imediatamente B: caranguejo e camarão têm cobertura rígida e pernas que se dobram em juntas; deixe a explicação do critério para as telas seguintes.",
          kind: "hook",
          skills: [],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Marília compara um morcego e uma libélula. Peça que escolha a observação mais útil para separá-los em grandes grupos: ossos que sustentam o morcego por dentro, em contraste com a cobertura rígida e as pernas com juntas da libélula. Inclua como alternativa tentadora o fato de ambos terem asas.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Apresente os poríferos por uma esponja presa à rocha: a água entra por muitos poros, como em um filtro, e sai por uma abertura maior. Mostre que seu corpo não apresenta metades regularmente espelhadas, ao contrário do corpo de muitos outros animais.",
          kind: "explanation",
          skills: [0],
          visual:
            "Esponja inteira presa a uma rocha, com poros pequenos distribuídos pelo corpo, abertura maior no alto e setas mostrando a entrada e a saída da água.",
          visualKind: "picture",
        },
        {
          activityTemplate: null,
          brief:
            "Apresente os cnidários com uma água-viva: seus tentáculos têm células que picam, como minúsculos ferrões, e suas partes se distribuem em torno de um centro. Contraste esses traços com os poros por onde a água atravessa uma esponja.",
          kind: "explanation",
          skills: [0],
          visual:
            "Água-viva inteira, com centro do corpo, tentáculos distribuídos ao redor e detalhe ampliado de uma célula que pica em um tentáculo.",
          visualKind: "picture",
        },
        {
          activityTemplate: null,
          brief:
            "Davi observa um animal de água doce preso a uma pedra, com tentáculos que capturam presas e picam; a água não atravessa seu corpo por poros. Peça que o classifique como cnidário ou porífero e escolha o traço decisivo. Inclua como erro tentador classificá-lo como porífero apenas por estar preso à pedra.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Apresente os artrópodes por um caranguejo: a cobertura rígida protege por fora como uma armadura, mas as pernas se dobram nas juntas. Explique que essa combinação, e não o ambiente aquático, também permite reconhecer insetos e aranhas.",
          kind: "explanation",
          skills: [0],
          visual:
            "Caranguejo inteiro com a cobertura rígida destacada e juntas marcadas em duas pernas; as demais pernas permanecem visíveis.",
          visualKind: "picture",
        },
        {
          activityTemplate: null,
          brief:
            "Apresente os vertebrados por um peixe: ossos internos sustentam o corpo, e uma coluna de ossos percorre as costas como a viga de uma estrutura. Compare a posição desse suporte com a cobertura rígida externa do caranguejo; ambos vivem na água, mas não pertencem ao mesmo grupo.",
          kind: "explanation",
          skills: [0],
          visual:
            "Peixe visto de lado, com contorno do corpo, ossos internos e coluna ao longo das costas destacados.",
          visualKind: "picture",
        },
        {
          activityTemplate: "categorize",
          brief:
            "Raíssa organiza quatro registros pelos grupos e critérios vistos: animal fixo de água doce atravessado pela água por poros → poríferos; animal marinho com tentáculos que picam → cnidários; animal terrestre com cobertura rígida e pernas com juntas → artrópodes; animal aquático com coluna de ossos interna → vertebrados. Peça que arraste cada registro ao grupo correspondente e escolha qual registro não pode ser classificado apenas pelo habitat.",
          kind: "activity",
          skills: [0],
          visual: null,
          visualKind: "template",
        },
        {
          activityTemplate: null,
          brief:
            "Apresente os moluscos ao resolver passo a passo um registro de Fábio: o animal marinho tem corpo mole, uma concha, nenhuma coluna de ossos e nenhuma perna com juntas. Compare esses indícios com os de um caranguejo; conclua que é um molusco, pois ter uma proteção dura, sozinho, não o torna artrópode.",
          kind: "workedExample",
          skills: [0],
          visual:
            "Dois desenhos lado a lado, identificados como 1 e 2: animal de corpo mole dentro de uma concha, sem pernas; caranguejo com cobertura rígida e pernas com juntas.",
          visualKind: "picture",
        },
        {
          activityTemplate: null,
          brief:
            "Cíntia recebe o registro de um polvo: corpo mole, sem concha, sem coluna de ossos e sem pernas com juntas. Peça que identifique o grupo e justifique por que a ausência de concha não impede a classificação como molusco. Inclua como alternativa tentadora excluí-lo dos moluscos porque o exemplo anterior tinha concha.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Igor revisa um inventário costeiro que colocou no mesmo grupo um caracol-marinho de corpo mole com concha e um caranguejo de cobertura rígida com pernas articuladas, porque ambos têm uma proteção dura e vivem no mar. Peça que decida se mantém ou corrige o registro, atribua o grupo de cada animal e indique quais traços pesam mais que concha e habitat compartilhados. Inclua a decisão tentadora de manter o agrupamento pela proteção dura.",
          kind: "application",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
      ],
      skills: [
        {
          description:
            "Comparar poros, tentáculos, sustentação e partes articuladas permite distinguir grupos animais mesmo quando compartilham habitat ou aparência.",
          example:
            "Um caranguejo e um caracol-marinho têm proteção dura, mas só o caranguejo tem pernas com juntas e cobertura rígida externa.",
          hard: true,
          name: "Comparar planos corporais de animais",
          topic: "Grupos de animais",
          useCase: "Revisar a classificação de animais em um levantamento de biodiversidade.",
        },
      ],
      title: "Grupos de animais",
    },
  },
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
            "Em Macapá, Nayara registra a energia de uma cadeia do rio: 1.000 unidades nas algas, 120 nos crustáceos que as comem e 14 nos peixes que comem os crustáceos. Mostre esses valores em um gráfico de barras e termine na pergunta aberta, sem opções: para onde vai a energia que some de um grupo para o outro?",
          kind: "hook",
          skills: [],
          visual: null,
          visualKind: "chart",
        },
        {
          activityTemplate: null,
          brief:
            "Mostre que a luz do Sol é a principal entrada de energia nessa sequência: as algas usam parte dela para produzir alimento, no qual fica energia disponível para outros seres vivos. Use a comparação com carregar uma bateria: nem toda a luz recebida fica guardada.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Em Macapá, Nayara registra 1.000 unidades de energia nas algas, 120 nos crustáceos que as comem e 14 nos peixes que comem os crustáceos. Volte ao gráfico de Nayara e pergunte: se a energia continuar diminuindo, qual valor poderia aparecer no grupo que come esses peixes? Opções: 10, 120, 140, 1.000 ou 1.140 unidades; revele 10 assim que você escolher, sem explicar o motivo ainda.",
          kind: "guess",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Explique a respiração celular como o uso do alimento pelo organismo para manter o corpo funcionando, semelhante a um motor que usa combustível e libera calor. Além dessa energia liberada, partes que não são comidas não passam ao consumidor seguinte daquele caminho.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Renan, em Maringá, afirma que a energia diminui entre um grupo e outro porque é destruída durante a respiração celular. Peça que você avalie a afirmação e escolha a correção: parte da energia é liberada ao ambiente como calor; inclua como alternativa tentadora que toda a energia do alimento passa intacta ao próximo consumidor.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Apresente a pirâmide de energia como uma forma de comparar a energia disponível em cada nível trófico: sua base é maior porque a cada transferência chega menos energia ao grupo seguinte. Mostre um gráfico de barras com plantas: 900 unidades; insetos que as comem: 108; aves que comem os insetos: 15.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Esclareça que a diminuição não segue uma porcentagem obrigatória: quanto fica disponível ao próximo grupo depende, entre outras coisas, do alimento consumido e da energia usada pelos organismos. Portanto, não se deve aplicar automaticamente uma regra de transferência de 10% a toda sequência.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: "categorize",
          brief:
            "Em uma sequência de taboas → caramujos → marrecos, peça que você separe os destinos da energia em «pode chegar ao próximo consumidor desse caminho» e «não chega ao próximo consumidor desse caminho». Use como itens: energia no corpo de caramujos comidos pelos marrecos; energia nas partes das taboas comidas pelos caramujos; calor liberado pelos caramujos; energia nas partes das taboas que nenhum caramujo come. A distinção importante é que algo não consumido nesse caminho não desaparece.",
          kind: "activity",
          skills: [0],
          visual: null,
          visualKind: "template",
        },
        {
          activityTemplate: null,
          brief:
            "Em Petrolina, Jussara avalia um açude com plantas aquáticas, moluscos que as comem, peixes pequenos que comem os moluscos e peixes predadores que comem os peixes pequenos. Mostre um gráfico de barras com 12.000, 1.600, 180 e 21 unidades de energia nesses grupos, respectivamente. Para obter mais energia na pesca a partir da mesma base de plantas, peça que você escolha entre capturar peixes pequenos ou predadores e justifique usando os dados e a perda de energia nas transferências; inclua a opção tentadora de escolher predadores por estarem no topo da sequência.",
          kind: "application",
          skills: [0],
          visual: null,
          visualKind: "none",
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
      title: "Fluxo de energia e pirâmides tróficas",
    },
  },
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
            "Renan confere uma peça de 50,0 mm com dois sensores do laboratório. Mostre numa tabela as três leituras de cada um: A: 49,8; 49,9; 50,0 mm; C: 48,0; 50,0; 52,0 mm. Os dois acertam 50,0 mm uma vez. Pergunte, sem opções, se os dois são igualmente confiáveis.",
          kind: "hook",
          skills: [],
          visual: null,
          visualKind: "table",
        },
        {
          activityTemplate: null,
          brief:
            "Apresente a precisão como o agrupamento das leituras: quanto mais próximas umas das outras, maior a precisão. Mostre numa tabela, com referência de 20,0 cm, o grupo X (22,0; 22,1; 22,2 cm) e o grupo Y (19,0; 20,0; 21,0 cm): X é mais preciso. Deixe claro que a precisão sozinha não diz se o resultado está perto da referência.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "table",
        },
        {
          activityTemplate: null,
          brief:
            "Um terceiro sensor de Renan lê 51,0; 51,0; 51,1 mm na peça de 50,0 mm. Pergunte o que ele é: preciso e exato; preciso, mas não exato; exato, mas não preciso; nem um nem outro. Resposta: preciso, mas não exato; a próxima tela mostra por quê.",
          kind: "guess",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Apresente a exatidão como a proximidade do resultado central à referência: Y se distribui em torno de 20,0 cm, e X se agrupa em torno de 22,1 cm. Mostre que agrupar leituras e acertar o alvo são avaliações diferentes.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Com referência de 5,00 V, o multímetro P leu 5,30; 5,31; 5,30 V e o multímetro Q leu 4,80; 5,00; 5,20 V. Mostre as leituras numa tabela e peça que o aluno escolha a descrição correta: P é mais preciso e Q tem o resultado central mais exato. Inclua como alternativa tentadora que o mais preciso também é o mais exato.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "table",
        },
        {
          activityTemplate: null,
          brief:
            "Com referência de 100,0 g, o sensor C leu 98,0; 100,0; 102,0 g e o sensor D leu 103,0; 103,1; 103,2 g. Pergunte qual sensor repete quase o mesmo resultado, mas exige investigar seu desvio da referência. Resposta: D; inclua como alternativa tentadora escolher C por ter uma leitura igual à referência.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Apresente a incerteza como a margem que comunica a variação observada: com leituras de 8,0; 8,2; 8,4 cm, o meio entre os extremos é 8,2 cm e metade da distância entre eles é 0,2 cm, então a estimativa é 8,2 ± 0,2 cm. Esclareça que essa margem não garante que a referência esteja dentro dela.",
          kind: "explanation",
          skills: [1],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Jussara mede uma peça três vezes e obtém 18,6; 18,8; 19,0 mm. Mostre passo a passo o meio entre a menor e a maior leitura (18,8 mm), a distância entre os extremos (0,4 mm) e metade dela como margem (0,2 mm), chegando a 18,8 ± 0,2 mm.",
          kind: "workedExample",
          skills: [1],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Dê três leituras da mesma medida, 11,7; 11,9; 12,1 cm, e peça o resultado central com a margem pelo procedimento de Jussara. Resposta: 11,9 ± 0,2 cm; inclua como alternativa tentadora 11,9 ± 0,4 cm, que usa a distância inteira entre os extremos como margem.",
          kind: "check",
          skills: [1],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Kauã estima a incerteza de 31,6; 32,0; 32,4 °C em quatro passos: o meio dos extremos é 32,0 °C; a distância entre eles é 0,4 °C; a metade é 0,2 °C; o resultado é 32,0 ± 0,2 °C. Peça que você encontre o primeiro passo errado: a distância é 0,8 °C, então o resultado é 32,0 ± 0,4 °C; inclua como alternativa tentadora apontar o último passo.",
          kind: "check",
          skills: [1],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Na Termolab, em Joinville, Tainá escolhe um sensor para peças de referência 50,0 mm: o resultado central deve ficar a no máximo 0,2 mm dela, e a margem estimada deve ser de no máximo 0,2 mm. Mostre numa tabela as leituras do sensor A (49,5; 49,6; 49,7 mm) e do sensor B (49,8; 50,0; 50,2 mm) e peça que você escolha o sensor que atende às duas condições, com os resultados aproximados de A e B. Resposta: B (A: 49,6 ± 0,1 mm; B: 50,0 ± 0,2 mm); inclua como alternativa tentadora escolher A por ter a menor margem.",
          kind: "application",
          skills: [0, 1],
          visual: null,
          visualKind: "none",
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
      title: "Precisão, exatidão e incerteza",
    },
  },
};
