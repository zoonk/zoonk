import { type LessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec/rules";

/**
 * Specs written by hand in the shape the spec task makes, so the writer is judged on activities
 * whose content code checks hardest: a code runner whose solution is run before publishing, a
 * labeled diagram whose picture code numbers from its parts, a decision tree whose case comes
 * with a picture, and the engines merged in Oct 2026 (a combination grid and a random simulation,
 * two lines and their crossing, a chord heard by ear).
 */
export const ACTIVITY_LESSON_SPECS = {
  "en-major-minor-by-ear": {
    canDo: "Hear whether a chord is major or minor",
    description: "Hear the one note that turns a bright major chord into a darker minor one.",
    estimatedMinutes: 3,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Happy birthday sounds bright and a sad film theme sounds dark, often with the same root note. Open with that contrast: one note makes the difference.",
        kind: "hook",
        skills: [],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "A major chord is a root, a major third (4 half steps up) and a fifth: C, E, G. Lower the middle note one half step and you get a minor chord: C, Eb, G. Major sounds bright; minor sounds darker.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: "keyboardFretboard",
        brief:
          "By ear: the app plays an A minor chord (A, C, E) together, without naming it. The learner picks whether it was major or minor, then sees it on the keys. Tempting wrong answer: major, from not hearing the lowered third.",
        kind: "activity",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Ask which note changes when C major becomes C minor. Correct: E drops to Eb. Tempting wrong answer: G drops to Gb, the top note.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Maya plays G, B, D on her keyboard for a sad song and it sounds too bright. Ask which single key she should change (B to Bb) and why.",
        kind: "application",
        skills: [0],
        visual: null,
      },
    ],
    skills: [
      {
        description:
          "A major chord's middle note is 4 half steps above the root; lowering it one half step makes the chord minor and darker.",
        example: "C, E, G is C major; C, Eb, G is C minor.",
        hard: false,
        name: "Tell major and minor chords apart",
        topic: "Chords",
        useCase: "Choosing chords that fit the mood of a song you play.",
      },
    ],
    supportMode: "explanationFirst",
    title: "Major or minor?",
  },
  "en-pea-crosses-chance": {
    canDo: "Predict the share of offspring with a trait from one cross",
    description: "Fill a Punnett square, then see 100 seeds land close to what it predicts.",
    estimatedMinutes: 4,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Mendel crossed purple and white pea plants and counted thousands of seeds: the white flowers came back in neat proportions. Open with that surprise.",
        kind: "hook",
        skills: [],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Each parent passes one of its two alleles. P (purple) is dominant over p (white): Pp is purple, only pp is white. A Pp × pp cross gives Pp or pp, each half the time.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: "combinationGrid",
        brief:
          "The learner fills the Punnett square for a purple Pp plant crossed with a white pp plant, then answers what share of the seeds grow white flowers (1 in 2). Tempting wrong answer: 1 in 4, from remembering the Pp × Pp cross.",
        kind: "activity",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: "randomSimulation",
        brief:
          "Chance mode: plant batches of 100 seeds from the same Pp × pp cross, each white with chance 1/2. The learner guesses how often a batch has exactly 50 white flowers, then runs many batches: they land near 50, rarely on it (about 8% of the time). Tempting wrong answer: most of the time.",
        kind: "activity",
        skills: [1],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "A gardener gets 47 white flowers out of 100 seeds from a Pp × pp cross. Ask whether the 1 in 2 prediction was wrong. Correct: no, chance spreads results around 50.",
        kind: "application",
        skills: [0, 1],
        visual: null,
      },
    ],
    skills: [
      {
        description:
          "A Punnett square pairs each parent's alleles to show every possible offspring, and the share of squares gives each trait's chance.",
        example: "Pp × pp gives two Pp and two pp squares: 1 in 2 white.",
        hard: false,
        name: "Use a Punnett square to predict a trait",
        topic: "Mendelian genetics",
        useCase: "Predicting what a garden cross or a pet breeding will produce.",
      },
      {
        description:
          "A chance tells you what to expect over many tries, not exactly what one batch will show.",
        example: "With chance 1/2, 100 seeds give about 50 white flowers, often 45 to 55.",
        hard: false,
        name: "Expect chance results to spread",
        topic: "Probability",
        useCase: "Not overreacting when a real batch misses the prediction a little.",
      },
    ],
    supportMode: "explanationFirst",
    title: "From Punnett squares to real seeds",
  },
  "en-python-range-beginner": {
    canDo: "Make a Python loop run exactly the numbers you want",
    description:
      "Read range(start, stop) as counting up to but not including stop, and fix loops that stop one number early.",
    estimatedMinutes: 4,
    screens: [
      {
        activityTemplate: null,
        brief:
          "A loop meant to print the numbers 1 to 5 prints only 1 to 4. Ask the learner to guess, without scoring, why the last number goes missing.",
        kind: "hook",
        skills: [],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "range(start, stop) starts at start and stops before stop: range(1, 5) gives 1, 2, 3, 4. To reach 5, the stop is 6. The count of numbers is stop minus start.",
        kind: "explanation",
        skills: [0],
        visual:
          "The numbers 1 to 6 on a line, with range(1, 5) highlighting 1 to 4 and 5 left out.",
      },
      {
        activityTemplate: null,
        brief:
          "Ask what for n in range(2, 6): print(n) prints. Tempting wrong answer: 2, 3, 4, 5, 6. Right: 2, 3, 4, 5, because the stop isn't included.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: "codeRunner",
        brief:
          "The learner fixes a Python loop that should print the numbers 1 to 5, one per line, but uses range(1, 5). Only the loop line is editable. Likely mistakes: range(0, 5), which prints 0 to 4, and range(1, 5) left as it is.",
        kind: "activity",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "A countdown uses for n in range(10, 0, -1). Ask what the last number printed is. Tempting wrong answer: 0. Right: 1, because the stop is still left out when counting down.",
        kind: "application",
        skills: [0],
        visual: null,
      },
    ],
    skills: [
      {
        description:
          "Choose start and stop values for range() so a loop covers exactly the numbers needed, remembering the stop is left out.",
        example: "for n in range(1, 6): print(n) prints 1, 2, 3, 4 and 5.",
        hard: false,
        name: "Choose range() bounds for a loop",
        topic: "Loops",
        useCase: "Looping over pages, days or items without skipping the last one.",
      },
    ],
    supportMode: "explanationFirst",
    title: "Count with range() in Python",
  },
  "en-tree-key-beginner": {
    canDo: "Name a common tree from one of its leaves with a simple key",
    description:
      "Tell needles from broad leaves, then use a key one question at a time to name pines, spruces, oaks and maples.",
    estimatedMinutes: 4,
    screens: [
      {
        activityTemplate: null,
        brief:
          "In a park, two trees look alike from far away, but one keeps its leaves all winter. Ask the learner to guess, without scoring, which part of a tree gives it away fastest.",
        kind: "hook",
        skills: [],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "A tree key asks one question at a time about what you can see. First: needles or broad leaves? Needles in bundles mean a pine; single needles on the twig mean a spruce or fir. Broad leaves with rounded lobes mean an oak; pointed lobes mean a maple.",
        kind: "explanation",
        skills: [0],
        visual:
          "A simple tree key drawn as branches: needles or broad leaves, then bundles or single needles, then rounded or pointed lobes.",
      },
      {
        activityTemplate: "decisionTree",
        brief:
          "The learner walks a key to name the tree from a leaf they can see: long needles growing in bundles of two. Likely mistake: stopping at needles and saying spruce, without checking whether they grow in bundles.",
        kind: "activity",
        skills: [0],
        visual: "A pine twig with long needles growing in bundles of two, close up.",
      },
      {
        activityTemplate: null,
        brief:
          "Ask which question a key should ask first about a maple leaf. Tempting wrong answer: whether its lobes are pointed. Right: whether it has needles or broad leaves, because a key narrows from the broadest feature down.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "On a walk, a friend finds a broad leaf with rounded lobes. Ask which tree the key leads to and why. Right: an oak, because broad leaves with rounded lobes lead there.",
        kind: "application",
        skills: [0],
        visual: null,
      },
    ],
    skills: [
      {
        description:
          "Use a branching key one question at a time, from the broadest feature to the finest, to name a common tree from a leaf.",
        example: "Needles in bundles of two lead to a pine; single needles lead to a spruce.",
        hard: false,
        name: "Name a tree with a leaf key",
        topic: "Identifying trees",
        useCase: "Naming trees on a walk or in a park from one leaf.",
      },
    ],
    supportMode: "explanationFirst",
    title: "Name a tree from one leaf",
  },
  "en-ux-goals-spot-ai": {
    canDo: "Write a UX goal that names the change without naming a solution",
    description:
      "State what should change in people's experience before choosing a design, and catch a goal that hides a solution.",
    estimatedMinutes: 4,
    screens: [
      {
        activityTemplate: null,
        brief:
          "A team writes the goal 'Add a progress bar to checkout'. Ask the learner to guess, without scoring, whether that is a goal or a solution. Answer: a solution.",
        kind: "hook",
        skills: [],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "A UX goal names the change in people's experience ('fewer people give up at payment'), not the design that might cause it ('add a progress bar'). Explain with the checkout example.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Ask which of three statements is a UX goal. Tempting wrong answer: 'Redesign the payment button', a solution phrased like a goal.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: "findError",
        brief:
          "Spot the AI's mistake: a designer asked an AI assistant to turn interview notes into a UX goal for a food delivery app. The assistant's four steps read the notes, find that people abandon orders when the delivery fee appears late, then in step 2 decide the goal is 'show the fee on the home screen' (the mistake: a solution, not a change in experience), and in steps 3 and 4 build the success measure and the summary on that wrong goal.",
        kind: "activity",
        skills: [1],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Application: in a banking app, support tickets show people can't find where to change their card limit. Ask the learner to pick the UX goal among options that mix goals and solutions.",
        kind: "application",
        skills: [0, 1],
        visual: null,
      },
    ],
    skills: [
      {
        description:
          "Write a goal that names the change in people's experience, not the design that might cause it.",
        example: "'Fewer people give up when the fee appears' instead of 'Add a fee banner'.",
        hard: false,
        name: "Write a UX goal without a solution",
        topic: "UX goals",
        useCase: "Agreeing with a product team on what a redesign must change before designing it.",
      },
      {
        description: "Tell a real UX goal from a proposed solution written as if it were a goal.",
        example:
          "'Redesign the button' is a solution; 'people finish payment on the first try' is a goal.",
        hard: false,
        name: "Tell a UX goal from a proposed solution",
        topic: "UX goals",
        useCase: "Reviewing a brief or an AI assistant's summary before a design sprint.",
      },
    ],
    supportMode: "explanationFirst",
    title: "Writing UX goals",
  },
  "pt-camaras-do-coracao-beginner": {
    canDo: "Localizar as quatro câmaras do coração e dizer para onde cada lado bombeia o sangue",
    description:
      "Conheça átrios e ventrículos, o septo que separa os dois lados e o caminho do sangue para os pulmões e para o corpo.",
    estimatedMinutes: 4,
    screens: [
      {
        activityTemplate: null,
        brief:
          "O coração bate cerca de 100 mil vezes por dia sem misturar o sangue que vai para os pulmões com o que vai para o corpo. Peça um palpite, sem avaliar, de como ele consegue isso.",
        kind: "hook",
        skills: [],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "O coração tem quatro câmaras: dois átrios em cima, que recebem o sangue, e dois ventrículos embaixo, que bombeiam. O lado direito manda sangue para os pulmões; o esquerdo, para o corpo todo. O septo separa os dois lados.",
        kind: "explanation",
        skills: [0],
        visual:
          "Coração visto de frente, com os átrios em cima, os ventrículos embaixo e o septo no meio.",
      },
      {
        activityTemplate: "labeledDiagram",
        brief:
          "O aprendiz arrasta os nomes átrio direito, átrio esquerdo, ventrículo direito, ventrículo esquerdo e septo para o desenho do coração visto de frente. Confusão provável: trocar direito e esquerdo, já que o lado direito do coração fica à esquerda de quem olha.",
        kind: "activity",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Pergunte qual câmara bombeia o sangue para o corpo todo. Resposta tentadora: o ventrículo direito. Certa: o ventrículo esquerdo, que tem a parede mais grossa porque empurra o sangue mais longe.",
        kind: "check",
        skills: [0, 1],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Num exame, o médico ouve um sopro causado por um furo no septo. Pergunte o que acontece com o sangue. Resposta certa: sangue do lado esquerdo passa para o direito, e o sangue que vai para o corpo e para os pulmões se mistura.",
        kind: "application",
        skills: [0, 1],
        visual: null,
      },
    ],
    skills: [
      {
        description:
          "Nomear e localizar átrios, ventrículos e septo num desenho do coração visto de frente.",
        example:
          "No desenho de frente, o ventrículo esquerdo fica embaixo, à direita de quem olha.",
        hard: false,
        name: "Localizar as câmaras do coração",
        topic: "Anatomia do coração",
        useCase: "Ler desenhos e exames do coração na escola e em provas.",
      },
      {
        description:
          "Dizer para onde cada lado do coração bombeia o sangue: o direito para os pulmões, o esquerdo para o corpo.",
        example: "O ventrículo direito manda sangue para os pulmões pela artéria pulmonar.",
        hard: true,
        name: "Seguir o caminho do sangue no coração",
        topic: "Circulação",
        useCase: "Entender por que um defeito num lado do coração afeta os pulmões ou o corpo.",
      },
    ],
    supportMode: "explanationFirst",
    title: "As quatro câmaras do coração",
  },
  "pt-demanda-ovos-deslocamento": {
    canDo: "Prever o que acontece com o preço e a quantidade quando a demanda ou a oferta muda",
    description: "Arraste a curva certa e veja o novo preço de equilíbrio aparecer no gráfico.",
    estimatedMinutes: 4,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Em 2022, a gripe aviária matou milhões de galinhas nos EUA e a dúzia de ovos passou de cerca de US$ 1,80 para mais de US$ 4. Peça um palpite: o que mudou, a oferta ou a demanda?",
        kind: "hook",
        skills: [],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "O preço de equilíbrio fica onde a curva de oferta cruza a de demanda. Menos galinhas é menos oferta: a curva de oferta vai para a esquerda, e o cruzamento sobe para um preço maior com menos ovos vendidos.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: "lineCrossing",
        brief:
          "O aprendiz arrasta a curva certa para mostrar a gripe aviária (oferta para a esquerda) e vê o novo preço de equilíbrio. Use números de exemplo marcados como exemplo. Erro tentador: mover a demanda para a direita, porque o preço subiu.",
        kind: "activity",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Pergunte o que acontece com o preço e a quantidade de ovos se uma dieta da moda fizer muita gente comer mais ovos. Certa: demanda para a direita, preço e quantidade sobem. Tentadora: a oferta aumenta.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Uma padaria em Recife vê o preço do trigo cair depois de uma safra recorde. Pergunte o que acontece com a oferta de pão e o seu preço, e por quê.",
        kind: "application",
        skills: [0],
        visual: null,
      },
    ],
    skills: [
      {
        description:
          "Uma mudança na oferta ou na demanda desloca uma das curvas, e o novo cruzamento dá o novo preço e a nova quantidade.",
        example:
          "Menos galinhas deslocam a oferta de ovos para a esquerda: preço sobe, quantidade cai.",
        hard: true,
        name: "Prever o novo equilíbrio após um deslocamento",
        topic: "Oferta e demanda",
        useCase: "Entender por que o preço de um alimento dispara ou cai no mercado.",
      },
    ],
    supportMode: "explanationFirst",
    title: "Quando a curva se desloca",
  },
} satisfies Record<string, LessonSpec>;
