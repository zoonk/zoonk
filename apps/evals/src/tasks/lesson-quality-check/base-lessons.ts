import { type LessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec/rules";
import { type WrittenLesson } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { LESSON_SPECS } from "../lesson-writer/lesson-specs";

/**
 * Lessons the reviewer reads. The Portuguese ones are Sol's drafts from the
 * lesson-writer eval (26 Sep 2026), with the calculation steps repaired so
 * they pass the code checks; the English one is hand-written. Test cases plant
 * one defect in a copy of a lesson, and clean copies must pass.
 */
type BaseLesson = {
  chapterTitle: string;
  courseTitle: string;
  language: string;
  lesson: WrittenLesson;
  level: "overview" | "beginner" | "intermediate" | "advanced";
  spec: LessonSpec;
};

export const BASE_LESSONS = {
  eletron: {
    chapterTitle: "O átomo por dentro",
    courseTitle: "Física quântica",
    language: "pt",
    lesson: {
      screens: [
        {
          image: {
            alt: "Uma seta aponta para o núcleo, cercado pela região onde o elétron pode ser encontrado.",
            prompt:
              "Ilustração didática simples: núcleo no centro, região difusa ao redor indicando onde o elétron pode ser encontrado e seta apontando para o núcleo com o rótulo «atração». Sem desenhar uma órbita.",
          },
          kind: "hookGuess",
          options: [
            { isCorrect: false, text: "Porque gira rápido como um planeta." },
            { isCorrect: true, text: "Porque concentrá-lo tanto exige energia." },
            { isCorrect: false, text: "Porque o núcleo o empurra para longe." },
          ],
          question:
            "O núcleo atrai o elétron. Sem valer ponto: por que ele não termina espremido no núcleo?",
          reveal:
            "O núcleo atrai o elétron, mas espremê-lo num espaço minúsculo exige energia. A atração não decide tudo sozinha.",
        },
        {
          exampleLineIdea: "a imagem de um elétron desenhado como bolinha em uma aula ou vídeo",
          image: {
            alt: "Uma órbita de bolinha aparece riscada ao lado de uma região difusa chamada nuvem eletrônica.",
            prompt:
              "Comparação lado a lado: à esquerda, bolinha em órbita desenhada como trilha ao redor de um núcleo, com um X sobre a trilha; à direita, região difusa ao redor do núcleo com o rótulo «nuvem eletrônica».",
          },
          kind: "explanation",
          text: "Imagine procurar o elétron ao redor do núcleo. Em vez de uma bolinha seguindo uma trilha, você encontra uma região onde ele pode aparecer. Essa região se chama **nuvem eletrônica**. Ela não é uma trilha nem uma nuvem de matéria comum.",
          title: "Não é uma órbita",
        },
        {
          exampleLineIdea: null,
          image: {
            alt: "A nuvem espalhada é comparada a uma nuvem comprimida, cuja compressão exige energia.",
            prompt:
              "Duas versões do mesmo átomo: à esquerda, nuvem eletrônica espalhada ao redor do núcleo; à direita, nuvem muito comprimida junto ao núcleo, com seta e rótulo «comprimir exige energia». Sem mola.",
          },
          kind: "explanation",
          text: "O núcleo atrai o elétron para perto. Mas concentrar sua nuvem num espaço minúsculo exige mais energia. Pense em tentar confinar algo que resiste a ficar espremido: apertar tem um custo. Isso é só uma comparação; não existe uma mola dentro do átomo.",
          title: "Apertar exige energia",
        },
        {
          context: "O núcleo atrai o elétron para perto.",
          image: null,
          kind: "check",
          options: [
            {
              isCorrect: false,
              reason:
                "Essa imagem parece explicar por que ele não cai, mas trata o elétron como uma bolinha em órbita. Ela não descreve sua nuvem.",
              text: "Porque ele gira rápido como um planeta.",
            },
            {
              isCorrect: true,
              reason:
                "Você precisa considerar tanto a atração pelo núcleo quanto a energia necessária para confinar o elétron.",
              text: "Porque concentrar sua nuvem demais exige energia.",
            },
            {
              isCorrect: false,
              reason:
                "Pode parecer que a atração precisa parar, mas ela continua. O custo de concentrar o elétron é que impede essa explicação simples.",
              text: "Porque o núcleo deixa de atraí-lo quando chega perto.",
            },
          ],
          question: "Por que essa atração não basta para deixá-lo espremido no núcleo?",
        },
        {
          exampleLineIdea: "os átomos que formam a tela de um celular",
          image: {
            alt: "Uma nuvem ocupa uma região ao redor do núcleo, em vez de se concentrar num ponto central.",
            prompt:
              "Núcleo cercado por uma nuvem eletrônica de tamanho definido. Ao lado, um ponto minúsculo sobre o núcleo marcado «concentração excessiva», em contraste com a nuvem ao redor.",
          },
          kind: "explanation",
          text: "O arranjo mais estável leva em conta duas coisas: o núcleo atrai o elétron, e confiná-lo demais custa energia. Por isso, mesmo no estado de menor energia, a nuvem ocupa uma região ao redor do núcleo. O elétron não fica espremido num ponto.",
          title: "O arranjo mais estável",
        },
        {
          context: "Alguém diz: «O elétron não cai porque o núcleo o empurra para longe».",
          image: null,
          kind: "check",
          options: [
            {
              isCorrect: true,
              reason:
                "Você corrige o sentido da atração e considera o custo de confinar o elétron.",
              text: "O núcleo atrai o elétron, mas concentrá-lo demais exige energia.",
            },
            {
              isCorrect: false,
              reason:
                "Você acerta que há atração, mas volta à imagem de uma bolinha em órbita. O elétron ocupa uma nuvem, não uma trilha.",
              text: "O núcleo atrai o elétron, que escapa por girar como um planeta.",
            },
            {
              isCorrect: false,
              reason:
                "A frase erra ao dizer que o núcleo empurra. Isso não significa que não exista atração.",
              text: "O núcleo não atrai nem empurra o elétron.",
            },
          ],
          question: "Qual é o erro nessa frase?",
        },
        {
          acceptedAnswers: [],
          context:
            "Um celular é feito de átomos que não desabam sobre seus núcleos. Uma pessoa imagina os elétrons como bolinhas prestes a cair.",
          keyPoints: [
            "O núcleo atrai o elétron.",
            "O elétron ocupa uma nuvem, não uma órbita de bolinha.",
            "Concentrar o elétron num espaço minúsculo exige energia.",
            "No arranjo mais estável, a nuvem ocupa uma região ao redor do núcleo.",
          ],
          kind: "typedAnswer",
          question:
            "Como você explicaria a essa pessoa por que os elétrons não ficam espremidos nos núcleos?",
          sampleAnswer:
            "O núcleo atrai o elétron, mas ele não é uma bolinha em órbita: ocupa uma nuvem. Espremer essa nuvem no núcleo exige energia. Por isso, no arranjo mais estável, ela ocupa uma região ao redor dele.",
        },
      ],
      summary: [
        "O elétron não é uma bolinha seguindo uma órbita: ele pode ser encontrado numa região chamada nuvem eletrônica.",
        "O núcleo atrai o elétron, mas concentrá-lo num espaço minúsculo exige energia.",
        "Mesmo no estado de menor energia, a nuvem ocupa uma região ao redor do núcleo, em vez de ficar espremida nele.",
      ],
    },
    level: "overview",
    spec: LESSON_SPECS["pt-eletron-nucleo-overview"],
  },
  regra: {
    chapterTitle: "Razão e proporção",
    courseTitle: "Matemática",
    language: "pt",
    lesson: {
      screens: [
        {
          image: null,
          kind: "hookGuess",
          options: [
            { isCorrect: false, text: "Aumenta" },
            { isCorrect: false, text: "Diminui" },
            { isCorrect: false, text: "Fica igual" },
            { isCorrect: true, text: "Depende de quanto cada coisa mudou" },
          ],
          question:
            "Uma gráfica recebe um pedido maior e contrata mais gente. O prazo aumenta ou diminui? Dê seu palpite.",
          reveal:
            "Depende. Um pedido maior exige mais tempo, mas mais gente pode reduzir o tempo. Você precisa comparar as duas mudanças.",
        },
        {
          context:
            "Na gráfica, todos trabalham no mesmo ritmo. Compare cada mudança separadamente.",
          image: null,
          kind: "check",
          options: [
            {
              isCorrect: true,
              reason:
                "Com o pedido fixo, o dobro de gente divide o tempo pela metade. Com a equipe fixa, o dobro de trabalho exige o dobro de tempo.",
              text: "Cai pela metade; depois dobra.",
            },
            {
              isCorrect: false,
              reason:
                "É tentador pensar que qualquer aumento aumenta o prazo. Mas uma equipe maior termina o mesmo pedido mais rápido.",
              text: "Dobra nos dois casos.",
            },
            {
              isCorrect: false,
              reason:
                "Uma equipe maior reduz o prazo, mas um pedido maior aumenta o tempo quando você mantém a equipe.",
              text: "Cai pela metade nos dois casos.",
            },
            {
              isCorrect: false,
              reason:
                "Você trocou os efeitos: mais gente acelera o trabalho, enquanto mais trabalho leva mais tempo.",
              text: "Dobra; depois cai pela metade.",
            },
          ],
          question:
            "O que acontece com o prazo ao dobrar a equipe para o mesmo pedido? E ao dobrar o pedido com a mesma equipe?",
        },
        {
          exampleLineIdea:
            "O prazo de um pedido quando muda só a equipe ou só a quantidade encomendada.",
          image: {
            alt: "Com o pedido fixo, uma equipe maior leva menos tempo; com a equipe fixa, um pedido maior leva mais tempo.",
            prompt:
              "Duas cenas de uma gráfica. Mesmo pedido: 2 trabalhadores levam mais tempo que 4. Mesma equipe: 1 pilha de etiquetas leva menos tempo que 2. Rótulos: 'pedido fixo', 'equipe fixa', 'menos tempo', 'mais tempo'.",
          },
          kind: "explanation",
          text: "Você acabou de comparar duas mudanças separadas. Para o mesmo pedido, mais trabalhadores significam menos tempo: é uma relação **inversa**. Com a mesma equipe, mais etiquetas significam mais tempo: é uma relação **direta**. Diga sempre o que fica fixo.",
          title: "O que fica fixo?",
        },
        {
          exampleLineIdea:
            "O tempo para concluir um serviço quando muda apenas o tamanho da equipe.",
          image: null,
          kind: "explanation",
          text: "Para o mesmo muro, uma equipe de 4 pessoas leva 6 dias. Se ela dobra para 8 pessoas, o prazo cai pela metade. Calcular um valor mudando só uma grandeza, com a obra fixa, é uma **regra de três simples**. Aqui, equipe e tempo têm relação inversa.",
          title: "Uma mudança por vez",
        },
        {
          image: null,
          kind: "workedExample",
          problem:
            "Quatro trabalhadores terminam um muro em 6 dias. No mesmo ritmo, quantos dias 8 trabalhadores levam para terminar o mesmo muro?",
          result: "Oito trabalhadores terminam o muro em 3 dias.",
          steps: [
            { math: null, text: "Mantenha a obra fixa: é o mesmo muro." },
            {
              math: "\\frac{4}{8}",
              text: "Com mais trabalhadores, o tempo diminui. Use a razão inversa entre as equipes.",
            },
            { math: "6\\times\\frac{4}{8}=3", text: "Multiplique o prazo inicial por essa razão." },
          ],
          title: "Mais gente, menos dias",
        },
        {
          context:
            "{impressoras} impressoras fazem {etiquetas} etiquetas em {horas} horas, no mesmo ritmo.",
          correctReason:
            "Com {impressoras} impressoras fixas, o tempo cresce na mesma razão que a produção: de {etiquetas} para {meta} etiquetas. O prazo total é {result} horas.",
          kind: "mathCheck",
          math: {
            answer: 5,
            commonMistakes: [
              {
                expression: "horas*etiquetas/meta",
                misconception: "Razão invertida",
                reason:
                  "Você inverteu a razão das etiquetas. Com as impressoras fixas, produzir mais etiquetas leva mais tempo, não menos.",
              },
              {
                expression: "(meta-etiquetas)/(etiquetas/horas)",
                misconception: "Só o tempo extra",
                reason:
                  "Você calculou apenas o tempo das etiquetas adicionais e esqueceu o tempo gasto com a quantidade inicial.",
              },
            ],
            solution: "horas*meta/etiquetas",
            steps: [
              {
                expression: null,
                text: "As {impressoras} impressoras continuam trabalhando. Só a quantidade de etiquetas muda.",
              },
              {
                expression: "horas*meta/etiquetas",
                text: "Como mais etiquetas exigem mais tempo, multiplique {horas} pela razão entre {meta} e {etiquetas}.",
              },
              { expression: "horas*meta/etiquetas", text: "O novo prazo é {result} horas." },
            ],
            tolerance: { kind: "absolute", value: 0 },
            unit: "horas",
            variables: [
              { max: 5, min: 2, name: "impressoras", step: 1, unit: null, value: 2 },
              { max: 160, min: 40, name: "etiquetas", step: 40, unit: "etiquetas", value: 80 },
              { max: 5, min: 1, name: "horas", step: 1, unit: "horas", value: 2 },
              { max: 400, min: 200, name: "meta", step: 40, unit: "etiquetas", value: 200 },
            ],
          },
          question:
            "Mantendo as mesmas impressoras, quanto tempo elas levam para fazer {meta} etiquetas?",
        },
        {
          exampleLineIdea:
            "O prazo de uma encomenda quando mudam o tamanho do pedido e o número de máquinas.",
          image: null,
          kind: "explanation",
          text: "Agora imagine um pedido maior feito por mais impressoras. Mais etiquetas aumentam o tempo; mais impressoras o reduzem. Isso é uma **regra de três composta**: parta do tempo inicial, multiplique pela razão entre as quantidades de etiquetas e pela razão inversa entre os números de impressoras.",
          title: "Duas mudanças juntas",
        },
        {
          image: null,
          kind: "workedExample",
          problem:
            "Três impressoras fazem 240 etiquetas em 4 horas. No mesmo ritmo, quanto tempo 5 impressoras levam para fazer 600 etiquetas?",
          result: "Cinco impressoras fazem as 600 etiquetas em 6 horas.",
          steps: [
            { math: "4\\text{ horas}", text: "Comece pelo prazo conhecido." },
            {
              math: "\\frac{600}{240}",
              text: "A quantidade de etiquetas aumenta. Multiplique pela razão entre o pedido novo e o antigo.",
            },
            {
              math: "\\frac{3}{5}",
              text: "O número de impressoras também aumenta. Para o tempo, use a razão inversa.",
            },
            {
              math: "4\\times\\frac{600}{240}\\times\\frac{3}{5}=6",
              text: "Junte os dois efeitos.",
            },
          ],
          title: "Pedido maior, mais impressoras",
        },
        {
          context:
            "{maquinasAntigas} máquinas fazem {pecasAntigas} peças em {horas} horas, no mesmo ritmo.",
          correctReason:
            "Você multiplica o tempo pela razão entre {pecasNovas} e {pecasAntigas} peças e pela razão inversa entre {maquinasNovas} e {maquinasAntigas} máquinas. O resultado é {result} horas.",
          kind: "mathCheck",
          math: {
            answer: 4,
            commonMistakes: [
              {
                expression: "horas*(pecasNovas/pecasAntigas)*(maquinasNovas/maquinasAntigas)",
                misconception: "Máquinas como relação direta",
                reason:
                  "Você tratou mais máquinas como se elas aumentassem o prazo. Para a mesma quantidade de peças, mais máquinas reduzem o tempo.",
              },
              {
                expression: "horas*(pecasAntigas/pecasNovas)*(maquinasAntigas/maquinasNovas)",
                misconception: "Razão das peças invertida",
                reason:
                  "Você tratou mais peças como se elas reduzissem o prazo. Mantendo as máquinas fixas, mais peças exigem mais tempo.",
              },
            ],
            solution: "horas*(pecasNovas/pecasAntigas)*(maquinasAntigas/maquinasNovas)",
            steps: [
              { expression: null, text: "Parta de {horas} horas para {pecasAntigas} peças." },
              {
                expression: "horas*(pecasNovas/pecasAntigas)",
                text: "Ajuste pela quantidade de peças, que altera o tempo no mesmo sentido.",
              },
              {
                expression: "horas*(pecasNovas/pecasAntigas)*(maquinasAntigas/maquinasNovas)",
                text: "Ajuste pelo número de máquinas, que altera o tempo no sentido contrário.",
              },
              {
                expression: "horas*(pecasNovas/pecasAntigas)*(maquinasAntigas/maquinasNovas)",
                text: "O prazo calculado é {result} horas.",
              },
            ],
            tolerance: { kind: "absolute", value: 0 },
            unit: "horas",
            variables: [
              { max: 4, min: 2, name: "maquinasAntigas", step: 1, unit: "máquinas", value: 2 },
              { max: 200, min: 80, name: "pecasAntigas", step: 40, unit: "peças", value: 120 },
              { max: 6, min: 2, name: "horas", step: 1, unit: "horas", value: 3 },
              { max: 8, min: 4, name: "maquinasNovas", step: 1, unit: "máquinas", value: 4 },
              { max: 480, min: 240, name: "pecasNovas", step: 40, unit: "peças", value: 320 },
            ],
          },
          question: "Quanto tempo {maquinasNovas} máquinas levam para fazer {pecasNovas} peças?",
        },
        {
          context:
            "Na padaria do bairro, {fornosAntigos} fornos iguais assam {paesAntigos} pães em {horas} horas, no mesmo ritmo.",
          correctReason:
            "Na padaria, mais pães aumentam o tempo na mesma razão, enquanto mais fornos o reduzem na razão inversa. O novo prazo é {result} horas.",
          kind: "mathCheck",
          math: {
            answer: 5,
            commonMistakes: [
              {
                expression: "horas*(paesNovos/paesAntigos)",
                misconception: "Esquecer os fornos",
                reason:
                  "Você ajustou o prazo pelo pedido maior, mas não considerou que mais fornos assam os pães mais rápido.",
              },
              {
                expression: "horas*(paesNovos/paesAntigos)*(fornosNovos/fornosAntigos)",
                misconception: "Razão dos fornos invertida",
                reason:
                  "Você tratou mais fornos como se aumentassem o tempo. Com a quantidade de pães fixa, mais fornos reduzem o prazo.",
              },
            ],
            solution: "horas*(paesNovos/paesAntigos)*(fornosAntigos/fornosNovos)",
            steps: [
              {
                expression: "horas*(paesNovos/paesAntigos)",
                text: "Mais pães aumentam o tempo. Ajuste o prazo pela razão entre as quantidades.",
              },
              {
                expression: "horas*(paesNovos/paesAntigos)*(fornosAntigos/fornosNovos)",
                text: "Mais fornos reduzem o tempo. Ajuste pela razão inversa entre os fornos.",
              },
              {
                expression: "horas*(paesNovos/paesAntigos)*(fornosAntigos/fornosNovos)",
                text: "O prazo para a nova fornada é {result} horas.",
              },
            ],
            tolerance: { kind: "absolute", value: 0 },
            unit: "horas",
            variables: [
              { max: 4, min: 2, name: "fornosAntigos", step: 1, unit: "fornos", value: 2 },
              { max: 200, min: 80, name: "paesAntigos", step: 40, unit: "pães", value: 120 },
              { max: 6, min: 2, name: "horas", step: 1, unit: "horas", value: 3 },
              { max: 6, min: 3, name: "fornosNovos", step: 1, unit: "fornos", value: 3 },
              { max: 480, min: 240, name: "paesNovos", step: 20, unit: "pães", value: 300 },
            ],
          },
          question: "Quanto tempo {fornosNovos} fornos levam para assar {paesNovos} pães?",
        },
      ],
      summary: [
        "Com o trabalho fixo, mais trabalhadores ou máquinas reduzem o tempo; com a capacidade fixa, mais trabalho aumenta o tempo.",
        "Na regra de três simples, você ajusta o prazo pela razão da única grandeza que mudou.",
        "Na regra de três composta, você ajusta o prazo por cada mudança: razão direta para a quantidade de trabalho e razão inversa para a capacidade de produção.",
      ],
    },
    level: "intermediate",
    spec: LESSON_SPECS["pt-regra-de-tres-intermediate"],
  },
  temperature: {
    chapterTitle: "Negative numbers",
    courseTitle: "Everyday math",
    language: "en",
    lesson: {
      screens: [
        {
          image: null,
          kind: "hookGuess",
          options: [
            { isCorrect: true, text: "2 °C" },
            { isCorrect: false, text: "8 °C" },
            { isCorrect: false, text: "−8 °C" },
          ],
          question: "It's −3 °C at dawn and it warms up 5 degrees. What does the thermometer show?",
          reveal:
            "It shows 2 °C. The next screens show why, and guessing first helps you remember.",
        },
        {
          exampleLineIdea: "A cold morning where the learner lives.",
          image: {
            alt: "A thermometer with an arrow going up past zero.",
            prompt: "A thermometer from −5 °C to 5 °C with an arrow going up past zero.",
          },
          kind: "explanation",
          text: "A rise always moves **up** the thermometer. From −3 °C, going up 3 degrees takes you to zero.",
          title: "Up is up, even below zero",
        },
        {
          image: null,
          kind: "workedExample",
          problem: "It's −3 °C and the temperature rises 5 degrees. What's the new temperature?",
          result: "It's 2 °C: two degrees above zero.",
          steps: [
            { math: "-3 + 3 = 0", text: "First climb to zero: that takes 3 degrees." },
            { math: "0 + 2 = 2", text: "Two degrees of the rise are left, so keep going up." },
          ],
          title: "From −3 °C, up 5 degrees",
        },
        {
          context: null,
          correctReason: "You start at {start} °C and move {rise} degrees up.",
          kind: "mathCheck",
          math: {
            answer: 3,
            commonMistakes: [
              {
                expression: "rise - start",
                misconception: "Subtracts the negative start",
                reason: "You took the start away instead of adding the rise to it.",
              },
              {
                expression: "start - rise",
                misconception: "Moves down instead of up",
                reason: "A rise moves up the thermometer, not down.",
              },
            ],
            solution: "start + rise",
            steps: [
              {
                expression: "start + rise",
                text: "Move {rise} degrees up from {start} °C: {result} °C.",
              },
            ],
            tolerance: { kind: "absolute", value: 0 },
            unit: "°C",
            variables: [
              { max: -1, min: -10, name: "start", step: 1, unit: "°C", value: -4 },
              { max: 15, min: 2, name: "rise", step: 1, unit: "°C", value: 7 },
            ],
          },
          question:
            "At 6 am it was {start} °C. By noon it warmed up {rise} degrees. What's the temperature now?",
        },
        {
          exampleLineIdea: null,
          image: null,
          kind: "explanation",
          text: "Zero is just a mark on the way up. Count the degrees to zero, then the degrees after it.",
          title: "Zero is a stop, not a wall",
        },
        {
          content:
            '{"check": {"answer": 5, "explanation": "−3 + 8 = 5, so it\'s 5 °C at noon.", "kind": "numeric", "question": "What\'s the temperature at noon?", "tolerance": {"kind": "absolute", "value": 0.01}, "unit": "°C"}, "fields": {"label": "Temperature", "max": 7, "min": -5, "moves": [{"by": 3}, {"by": 5}], "start": -3, "step": 1, "unit": "°C"}, "prompt": "At 7 am it\'s −3 °C. By noon it\'s 8 degrees warmer. Move the dot."}',
          kind: "activity",
          template: "numberLine",
        },
        {
          acceptedAnswers: [],
          context: null,
          keyPoints: ["Going up 3 degrees reaches zero", "The last 2 degrees go above zero"],
          kind: "typedAnswer",
          question: "Explain in your own words why −3 °C plus 5 degrees is 2 °C.",
          sampleAnswer: "Three degrees get you to zero, and the other two take you to 2 °C.",
        },
        {
          context:
            "It's −6 °C on a winter morning in Chicago, and the forecast says it will warm up 9 degrees.",
          image: null,
          kind: "check",
          options: [
            {
              isCorrect: true,
              reason: "Six degrees reach zero and three more go above it.",
              text: "3 °C",
            },
            {
              isCorrect: false,
              reason: "That's what you get by moving down 9 degrees instead of up.",
              text: "−15 °C",
            },
            {
              isCorrect: false,
              reason: "You added the numbers without their signs: the start is below zero.",
              text: "15 °C",
            },
          ],
          question: "What will the thermometer show?",
        },
      ],
      summary: [
        "A rise moves up the thermometer, even below zero.",
        "Count up to zero first, then the degrees above it.",
      ],
    },
    level: "beginner",
    spec: {
      canDo: "Work out a temperature after it rises across zero",
      description: "Add a rise to a temperature below zero, the way thermometers do.",
      estimatedMinutes: 4,
      screens: [
        {
          activityTemplate: null,
          brief: "Guess the temperature after a 5 degree rise from −3 °C.",
          kind: "hook",
          skills: [],
          visual: null,
        },
        {
          activityTemplate: null,
          brief:
            "A rise moves up the thermometer, even below zero: from −3 °C, 3 degrees reach zero.",
          kind: "explanation",
          skills: [0],
          visual: "A thermometer from −5 °C to 5 °C with an arrow going up.",
        },
        {
          activityTemplate: null,
          brief: "From −3 °C, rise 5 degrees: climb to zero, then keep going.",
          kind: "workedExample",
          skills: [0],
          visual: null,
        },
        {
          activityTemplate: null,
          brief: "Calculate a rise from −4 °C; tempting wrong answer: subtracting.",
          kind: "check",
          skills: [0],
          visual: null,
        },
        {
          activityTemplate: null,
          brief: "Zero is just a mark on the way up: count to zero, then past it.",
          kind: "explanation",
          skills: [0],
          visual: null,
        },
        {
          activityTemplate: "numberLine",
          brief: "Move the dot from −3 °C by two rises and read the noon temperature.",
          kind: "activity",
          skills: [0],
          visual: null,
        },
        {
          activityTemplate: null,
          brief: "Explain in your own words why −3 + 5 is 2.",
          kind: "check",
          skills: [0],
          visual: null,
        },
        {
          activityTemplate: null,
          brief: "A winter morning in Chicago warming up 9 degrees from −6 °C.",
          kind: "application",
          skills: [0],
          visual: null,
        },
      ],
      skills: [
        {
          description: "A rise adds to the temperature, even when it starts below zero.",
          example: "−3 °C plus a 5 degree rise is 2 °C.",
          hard: true,
          name: "Add a rise to a temperature below zero",
          topic: "Temperature changes",
          useCase: "Reading a weather forecast.",
        },
      ],
      supportMode: "explanationFirst",
      title: "Temperature changes across zero",
    },
  },
} satisfies Record<string, BaseLesson>;
