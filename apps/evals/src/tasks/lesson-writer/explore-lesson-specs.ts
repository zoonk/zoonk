import { type LessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec/rules";

/**
 * Explanations that show an activity template to explore, nothing asked (Oct 2026, owner: "we
 * should probably support all artifacts"): a model to move, a process in order, a map and a
 * picture whose parts code numbers. The writer fills the template's fields on the explanation itself, and
 * code validates them like an activity's.
 */
export const EXPLORE_LESSON_SPECS = {
  "en-compound-growth-explore": {
    canDo: "Explain why a higher rate grows savings much faster over time",
    description: "See how the interest rate changes what $1,000 becomes after 20 years.",
    estimatedMinutes: 3,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Guess first: $1,000 left 20 years at 8% a year with interest kept in. Is it about $2,600, $4,700 or $9,000? Reveal about $4,700 at once.",
        kind: "hook",
        skills: [],
        visual: null,
      },
      {
        activityTemplate: "formulaModel",
        brief:
          "Show the balance of $1,000 after 20 years as the yearly rate moves from 0% to 12% (balance = 1000 × (1 + rate/100)^20), starting at 5%. The curve bends upward: going from 4% to 8% more than doubles the gain. The learner moves the rate and watches the balance.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Ask which grows more over 20 years: raising the rate from 2% to 4% or from 8% to 10%. Answer: 8% to 10% (about $1,994 more against $705). Tempting wrong answer: they're the same, both 2 points.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Ana can keep $5,000 for 20 years at 4% or at 6%. Ask how much more the 6% option ends with: $16,036 against $10,956, so $5,080 more. Tempting wrong answer: $2,000 (2% of $5,000 for 20 years without compounding).",
        kind: "application",
        skills: [0],
        visual: null,
      },
    ],
    skills: [
      {
        description: "Over many years, interest on interest makes a small rate change grow large.",
        example: "$1,000 for 20 years is $2,191 at 4% and $4,661 at 8%.",
        hard: false,
        name: "Compare savings growth at different rates",
        topic: "Compound growth",
        useCase: "Choosing a savings account or a pension fund.",
      },
    ],
    supportMode: "explanationFirst",
    title: "How the rate changes compound growth",
  },
  "en-heart-chambers-explore": {
    canDo: "Name the four chambers of the heart and what each one does",
    description: "Find the heart's chambers and follow which side sends blood where.",
    estimatedMinutes: 3,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Guess first: how many chambers does a human heart have: 2, 3 or 4? Reveal 4 at once.",
        kind: "hook",
        skills: [],
        visual: null,
      },
      {
        activityTemplate: "labeledDiagram",
        brief:
          "Show a picture of the heart seen from the front with the right atrium, left atrium, right ventricle, left ventricle and septum numbered and named. The two atria on top receive blood; the two ventricles below pump it out; the septum is the wall between the two sides. The heart is seen from the front, so its right side is on the viewer's left.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Ask which chamber pumps blood out to the whole body. Answer: the left ventricle. Tempting wrong answer: the right ventricle, because it's drawn on the viewer's left.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "A doctor hears a hole in the wall between the two ventricles. Ask what that wall is called and why a hole there mixes blood from the two sides: the septum. Tempting wrong answer: the atrium.",
        kind: "application",
        skills: [0],
        visual: null,
      },
    ],
    skills: [
      {
        description:
          "The heart has two atria on top that receive blood and two ventricles below that pump it.",
        example: "The left ventricle pumps blood to the whole body.",
        hard: false,
        name: "Name the chambers of the heart",
        topic: "Chambers of the heart",
        useCase: "Understanding a heart exam or a diagnosis.",
      },
    ],
    supportMode: "explanationFirst",
    title: "The chambers of the heart",
  },
  "pt-fotossintese-explore": {
    canDo: "Explicar em ordem as etapas da fotossíntese",
    description: "Siga a luz, a água e o gás carbônico até o açúcar que a planta guarda.",
    estimatedMinutes: 3,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Palpite: de onde vem a maior parte da massa de uma árvore: do solo, da água ou do ar? Revele de imediato: do ar, do gás carbônico.",
        kind: "hook",
        skills: [],
        visual: null,
      },
      {
        activityTemplate: "processOrder",
        brief:
          "Mostre as etapas da fotossíntese em ordem, cada uma com por que vem depois da anterior: a clorofila absorve a luz; a água é quebrada e libera oxigênio; a energia fica guardada em ATP e NADPH; o ciclo de Calvin usa essa energia para fixar o gás carbônico em açúcar; o açúcar é guardado como amido.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Pergunte o que acontece com o ciclo de Calvin numa planta que passou a noite toda no escuro. Resposta: ele para em pouco tempo, porque depende do ATP e do NADPH feitos com a luz. Resposta tentadora: continua igual, porque não usa luz diretamente.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Numa estufa, Bruno aumenta o gás carbônico do ar. Pergunte qual etapa ele acelera e por quê: a fixação do gás carbônico no ciclo de Calvin, se houver luz. Resposta tentadora: a quebra da água.",
        kind: "application",
        skills: [0],
        visual: null,
      },
    ],
    skills: [
      {
        description:
          "A planta usa a energia da luz para transformar gás carbônico e água em açúcar.",
        example: "O oxigênio que a planta solta vem da água quebrada na luz.",
        hard: false,
        name: "Explicar as etapas da fotossíntese",
        topic: "Fotossíntese",
        useCase: "Entender por que a produção de uma lavoura depende de luz e de gás carbônico.",
      },
    ],
    supportMode: "explanationFirst",
    title: "As etapas da fotossíntese",
  },
  "pt-imperio-romano-explore": {
    canDo: "Localizar no mapa até onde o Império Romano chegou em 117",
    description: "Veja as cidades que Roma governava em volta do Mediterrâneo no seu auge.",
    estimatedMinutes: 3,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Palpite: no auge, em 117, o Império Romano governava Alexandria, no Egito? Opções: sim; não, só a Europa; só até a Grécia. Revele de imediato: sim.",
        kind: "hook",
        skills: [],
        visual: null,
      },
      {
        activityTemplate: "mapExplorer",
        brief:
          "Mostre no mapa do Império Romano em 117 as cidades de Roma, Cartago (norte da África), Alexandria (Egito), Londinium (Britânia) e Antioquia (Síria), cada uma com o que mostra sobre o tamanho do império ao ser tocada. Todas ficam em volta do Mediterrâneo, que os romanos chamavam de 'nosso mar', menos Londinium.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Pergunte qual destas terras ficava fora do império em 117: Cartago, Antioquia ou a Hibérnia, a atual Irlanda. Resposta: a Hibérnia, que Roma nunca conquistou. Resposta tentadora: Antioquia, por ficar tão a leste.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Lívia planeja uma viagem de estudo por cidades que foram romanas. Pergunte qual roteiro fica todo dentro do império de 117: Lisboa, Cartago e Alexandria. Resposta tentadora: um roteiro com Moscou.",
        kind: "application",
        skills: [0],
        visual: null,
      },
    ],
    skills: [
      {
        description: "No auge, em 117, Roma governava terras em volta de todo o Mediterrâneo.",
        example: "Cartago, Alexandria e Antioquia eram cidades romanas em 117.",
        hard: false,
        name: "Localizar o Império Romano no seu auge",
        topic: "Império Romano",
        useCase: "Entender por que o latim e o direito romano chegaram a tantos países.",
      },
    ],
    supportMode: "explanationFirst",
    title: "Até onde chegou o Império Romano",
  },
} satisfies Record<string, LessonSpec>;
