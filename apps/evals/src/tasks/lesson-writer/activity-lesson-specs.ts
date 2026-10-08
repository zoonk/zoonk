import { type LessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec/rules";

/**
 * Specs written by hand in the shape the spec task makes, so the writer is judged on activities
 * whose content code checks hardest: a code runner whose solution is run before publishing, a
 * labeled diagram from the checked diagram library, and a decision tree whose case comes with a
 * picture.
 */
export const ACTIVITY_LESSON_SPECS = {
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
} satisfies Record<string, LessonSpec>;
