import { type OptionalCountry, type TestCase } from "@/lib/types";
import { type LessonSpecParams } from "@zoonk/ai/tasks/lesson-spec";
import { type SecondTakeInput } from "@zoonk/ai/tasks/lesson-spec/second-take";
import { listPlannerTemplates } from "@zoonk/core/library/activities/writer-templates";
import { type LessonSpecExpected } from "./visual-test-cases";

const SECOND_TAKE_EXPECTATIONS = `
  - Exactly one lesson, never split, whose only skill is the one given with its name kept, at the given level: a second explanation for learners who studied the lesson in FIRST_LESSON_MAP and still miss the skill in the ways WRONG_ANSWERS lists
  - Code checks the count of 6 to 10 screens, that the guess is the second screen, that \`opensOn\` names a given wrong answer, that no explanation or worked example follows the last check and that no brief copies a sentence of the map; don't grade those again
  - It opens on the wrong answer \`opensOn\` names: the scene shows someone giving it in a new case and getting a result it can't explain, and the guess right after has that same wrong answer as its tempting option; a scene on one wrong answer and a guess on another fails
  - A screen states the fact that wrong answer's "Why it's wrong" rests on, so the learner sees why it fails
  - Once the idea is taught, a screen comes back to the scene's own case and settles it: the right answer and why the scene's result happened. A scene whose case is never mentioned again fails
  - Each idea the plan teaches has a check of its own before the application, and the application combines only ideas a check practiced. Each wrong answer in WRONG_ANSWERS is either taught on a screen and practiced in a check, or left out of every screen; one taught only on the screen before the application, or tested only by the application, fails
  - It teaches only what the confusion needs: the core idea, the conditions the wrong answers miss and what tells the confused ideas apart. A screen spent on another point of FIRST_LESSON_MAP or on an extension (a new case type, a side effect, what comes next) is a scope slip
  - It takes another route to the idea than FIRST_LESSON_MAP: another representation (a table, a number line, a template, a picture, a story or a case where the map states a rule) or another starting point. Put the map next to the plan: when the explanations are the map's ideas said again in other words, in the same order with the same kind of example, it's a paraphrase and fails
  - The explanation right after the guess shows the wrong answer failing in one concrete case with small numbers or one short real example, before any rule is named
  - One check makes the learner decide, in a small case, between this idea and the one learners confuse it with, with the other as its tempting option
  - One worked example on a new case, followed by a check where the learner does a similar one with less help
  - Every check and the application is new: no question, case or set of numbers from FIRST_LESSON_MAP or WRONG_ANSWERS, and a wrong answer's sentence with one word swapped is not a new case. Each check is decided by a rule or fact an earlier screen of this plan states
  - Plain words for the level, every term explained again before any screen uses it, and every screen one idea or one decision a learner reads at a glance on a phone
  - Light enough that a tired learner on a phone finishes it in about 4 minutes: no screen the confusion doesn't need, a worked example with only the moves the confusion turns on (a repeated move counted, not written out once per repetition), and every question's options each one short answer a learner tells apart at a glance, never two answers paired in one option
  - \`title\` is in sentence case, isn't LESSON_TITLE, and says what's different about this lesson
  - The brief of the explanation that states the idea names where the learner's own example goes: an everyday setting outside the subject where the same idea happens
  - Don't evaluate JSON formatting; estimated minutes are computed by code
`;

type SecondTakeCase = TestCase<LessonSpecExpected, OptionalCountry<LessonSpecParams>>;

function secondTakeCase({
  expectations,
  id,
  secondTake,
  ...input
}: Omit<OptionalCountry<LessonSpecParams>, "activityTemplates" | "secondTake"> & {
  expectations: string;
  id: string;
  secondTake: SecondTakeInput;
}): SecondTakeCase {
  return {
    expectations: `${expectations}\n${SECOND_TAKE_EXPECTATIONS}`,
    expected: { secondTake },
    id: `second-take-${id}`,
    userInput: { activityTemplates: listPlannerTemplates(), ...input, secondTake },
  };
}

export const SECOND_TAKE_TEST_CASES: SecondTakeCase[] = [
  secondTakeCase({
    chapterTitle: "Exponents and scientific notation",
    courseTitle: "Quantum physics from scratch",
    expectations: `
      - MUST be in US English
      - The tempting wrong answer is a positive power for a number below 1. The plan reaches the idea another way than the map's counting of decimal-point jumps, such as rebuilding the number from the front number by multiplying or dividing by ten
      - The check that separates two ideas tells "same value" from "valid scientific notation" (a front number of 10 or more)
      - Wrong answers 4 and 5 are about a big number (the speed of light). Either the plan teaches big numbers on a screen and checks them before the application, or it leaves big numbers out of every screen and keeps the application on small numbers
      - The math is right on every screen
      - Regressions to avoid (real run, 27 Nov 2026): a scene where a dust sample of 0.004 g is entered as 4 × 10³ g and never shown written correctly; a screen teaching big numbers right before the application with no check of its own; a seven-step worked example writing out each division by ten; an application whose four options each pair two numbers; the title "Build Back the Original Number" in Title Case
    `,
    id: "en-scientific-notation",
    language: "en",
    lessonCanDo:
      "You'll write the size of an atom and the distance to the Sun in a few characters.",
    lessonDescription:
      "Physics works with numbers too big and too small to write out. Scientific notation fits them in a few characters.",
    lessonTitle: "Writing very big and very small numbers",
    level: "beginner",
    secondTake: {
      firstLessonMap: {
        ideas: [
          { text: "Scientific notation writes a number as a × 10ⁿ, with a between 1 and 10." },
          { text: "The power counts how many places the decimal point jumps." },
          { text: "Big numbers get positive powers; numbers below 1 get negative ones." },
          { text: "To compare, look at the powers first: each step up is ten times bigger." },
        ],
        shape: "hub",
      },
      wrongAnswers: [
        {
          answer: "5.2 × 10⁴",
          question: "How do you write 0.00052 in scientific notation?",
          reason:
            "A positive power makes a big number: 52,000. Numbers below 1 need a negative power.",
        },
        {
          answer: "52 × 10⁻⁵",
          question: "How do you write 0.00052 in scientific notation?",
          reason:
            "It's the same value, but the front number must be between 1 and 10. Move one more place: 5.2 × 10⁻⁴.",
        },
        {
          answer: "5.2 × 10⁻³",
          question: "How do you write 0.00052 in scientific notation?",
          reason: "Count the jumps again: from 0.00052 to 5.2 is 4 places, not 3.",
        },
        {
          answer: "30 × 10⁷ m/s",
          question:
            "Light travels about 300,000,000 meters per second. Which is that speed in scientific notation?",
          reason:
            "It's the same value, but the front number has to be between 1 and 10, and 30 isn't. Move one more place: 3 × 10⁸.",
        },
        {
          answer: "3 × 10⁹ m/s",
          question:
            "Light travels about 300,000,000 meters per second. Which is that speed in scientific notation?",
          reason:
            "300,000,000 has 8 places after the 3, so the power is 8. 3 × 10⁹ would be ten times faster.",
        },
      ],
    },
    skills: ["Write a number in scientific notation"],
  }),
  secondTakeCase({
    chapterTitle: "Adding and subtracting fractions",
    courseTitle: "Everyday math",
    expectations: `
      - MUST be in US English
      - The false rule is adding the tops and the bottoms (1/2 + 1/3 = 2/5). The plan shows why it fails with pieces of one whole (a bar, a circle or an area model the learner can see or explore) or another case where 2/5 is visibly less than 1/2, instead of starting from the common denominator procedure the map states
      - The check that separates two ideas tells "the bottom names the size of the pieces" from "the bottom counts pieces", or adding fractions from multiplying them, where tops and bottoms do combine
      - The math is right on every screen
      - A regression to avoid (first run, 26 Nov 2026): a screen on sums past one whole, which the wrong answers never raise
    `,
    id: "en-adding-fractions",
    language: "en",
    lessonCanDo: "Add two fractions with different denominators",
    lessonDescription:
      "Rewrite two fractions with the same denominator so their pieces are the same size, then add.",
    lessonTitle: "Adding fractions with unlike denominators",
    level: "beginner",
    secondTake: {
      firstLessonMap: {
        ideas: [
          {
            label: "Same-size pieces",
            text: "You can only add fractions when their pieces are the same size, which means the same denominator.",
          },
          {
            label: "Common denominator",
            text: "Find a number both denominators divide into, like 6 for halves and thirds. Rewrite each fraction with it: 1/2 is 3/6 and 1/3 is 2/6.",
          },
          {
            label: "Add the tops",
            text: "Once the denominators match, add the numerators and keep the denominator: 3/6 + 2/6 = 5/6.",
          },
          {
            label: "Simplify",
            text: "Divide the top and bottom by the same number when you can: 4/8 becomes 1/2.",
          },
        ],
        shape: "nested",
      },
      wrongAnswers: [
        {
          answer: "2/6",
          question: "What is 1/2 + 1/4?",
          reason:
            "This adds the bottoms too. The bottom number tells the size of the pieces, and adding pieces doesn't change their size.",
        },
        {
          answer: "2/9",
          question:
            "Maya eats 1/3 of a pizza and Leo eats 1/6. How much of the pizza did they eat?",
          reason:
            "Adding 3 and 6 gives ninths, which are smaller pieces than either of theirs, so the answer can't be less than what Maya ate alone.",
        },
        {
          answer: "2/8",
          question: "A recipe needs 1/4 cup of milk, then another 1/4 cup. How much milk in all?",
          reason: "Quarters stay quarters: two of them make 2/4, not eighths.",
        },
      ],
    },
    skills: ["Add fractions with unlike denominators"],
  }),
  secondTakeCase({
    chapterTitle: "Crase",
    courseTitle: "Português para concursos",
    expectations: `
      - MUST be in Brazilian Portuguese
      - The tempting rule is "crase before every feminine word" or "crase whenever a comes before a word". The plan rebuilds the idea from its parts: a crase is the preposition a meeting the article a, shown by a test the learner can run (swap the feminine word for a masculine one: "vou à praia" becomes "vou ao parque"; or check whether the verb asks for a), not by listing when it's used as the map does
      - The check that separates two ideas tells the preposition alone from preposition plus article, such as "a pé" or "a partir de", or a feminine word with no article ("a uma amiga") against "à praia"
      - Every example sentence is correct standard Portuguese, and the plan never states a rule a common case breaks (crase before a masculine word in "à moda de", or none before a verb)
      - Regressions to avoid (first run, 26 Nov 2026): a scene on the crase before a verb with a guess on "à uma", and a check on "começou à funcionar", which is the wrong answer "começou à estudar" with one word swapped
    `,
    id: "pt-crase",
    language: "pt",
    lessonCanDo: "Decidir quando usar crase",
    lessonDescription:
      "A crase marca o encontro da preposição a com o artigo a: quando ela aparece e quando não.",
    lessonTitle: "Quando usar crase",
    level: "intermediate",
    secondTake: {
      firstLessonMap: {
        ideas: [
          {
            label: "O que é crase",
            text: "Crase é a fusão de duas letras a: a preposição exigida por um termo e o artigo da palavra feminina que vem depois.",
          },
          {
            label: "Quando usar",
            text: "Use crase antes de palavra feminina quando o termo anterior pede a preposição a, como em obedecer à lei.",
          },
          {
            label: "Quando não usar",
            text: "Não há crase antes de verbo, de palavra masculina nem de pronomes como esta e ela.",
          },
          {
            label: "Locuções",
            text: "Locuções femininas como às vezes, à noite e à medida que levam crase.",
          },
        ],
        shape: "hub",
      },
      wrongAnswers: [
        {
          answer: "Ela começou à estudar cedo.",
          question: "Qual frase usa a crase corretamente?",
          reason: "Antes de verbo não há artigo, então não há o que fundir com a preposição.",
        },
        {
          answer: "Entreguei o relatório à uma colega.",
          question: "Em qual frase a crase está certa?",
          reason:
            "Uma é artigo indefinido: com ele não entra o artigo a, então só fica a preposição.",
        },
        {
          answer: "Sem crase: Vou a feira amanhã.",
          question: "A frase 'Vou a feira amanhã' precisa de crase?",
          reason: "Quem vai, vai a algum lugar, e feira pede o artigo a: a + a vira à.",
        },
      ],
    },
    skills: ["Decidir quando usar crase"],
  }),
  secondTakeCase({
    chapterTitle: "La Tierra en el espacio",
    country: "MX",
    courseTitle: "Ciencias naturales",
    expectations: `
      - MUST be in Mexican Spanish
      - The misconception is that summer comes when Earth is closer to the Sun. The plan shows the tilt another way than the map's statement of it: for example a flashlight on a table straight down against at a slant, the length of shadows at noon, the hours of daylight in a table for two cities, or both hemispheres having opposite seasons on the same day, and never repeats the map's sentence about the axis
      - The check that separates two ideas tells "how close Earth is to the Sun" from "how directly the sunlight hits and for how many hours", such as January: Earth closest to the Sun while Mexico is in winter
      - Every fact is right: Earth is closest to the Sun in early January, the axis tilts about 23.5 degrees, and the seasons are opposite in the two hemispheres
      - A screen says that Earth is closest to the Sun in early January, during Mexico's winter: a regression to avoid (first run, 26 Nov 2026) explained the tilt well but never showed why distance can't be the cause, and spent a screen on spring and autumn
    `,
    id: "es-seasons",
    language: "es",
    lessonCanDo: "Explicar por qué hay estaciones del año",
    lessonDescription:
      "La inclinación del eje de la Tierra cambia cómo llega la luz del Sol a lo largo del año.",
    lessonTitle: "Por qué hay estaciones",
    level: "beginner",
    secondTake: {
      firstLessonMap: {
        ideas: [
          {
            label: "El eje inclinado",
            text: "El eje de la Tierra está inclinado unos 23.5 grados respecto a su órbita.",
          },
          {
            label: "Luz directa",
            text: "En verano, el hemisferio inclinado hacia el Sol recibe la luz más directa y los días son más largos.",
          },
          {
            label: "Hemisferios opuestos",
            text: "Cuando en México es verano, en Argentina es invierno.",
          },
        ],
        shape: "hub",
      },
      wrongAnswers: [
        {
          answer: "Porque en verano la Tierra está más cerca del Sol.",
          question: "¿Por qué hace más calor en verano?",
          reason:
            "La distancia cambia poco y la Tierra está más cerca del Sol a principios de enero, en pleno invierno en México.",
        },
        {
          answer: "Porque el Sol calienta más en ciertos meses.",
          question: "¿Qué causa las estaciones?",
          reason:
            "El Sol da casi la misma energía todo el año; cambia cómo llega esa luz a cada lugar.",
        },
        {
          answer: "Es verano en los dos países.",
          question: "En julio es verano en Monterrey. ¿Qué estación es en Buenos Aires?",
          reason:
            "Si un hemisferio se inclina hacia el Sol, el otro se inclina lejos de él: allá es invierno.",
        },
      ],
    },
    skills: ["Explicar la causa de las estaciones del año"],
  }),
  secondTakeCase({
    chapterTitle: "Excludentes de ilicitude",
    courseTitle: "Direito Penal",
    exams: [
      {
        name: "OAB Exame de Ordem Unificado, 1ª fase",
        style:
          "multipleChoice (4 options): Questões de múltipla escolha com 4 opções (A, B, C e D) e uma única resposta correta.",
      },
    ],
    expectations: `
      - MUST be in Brazilian Portuguese, for candidates of the exam in EXAMS, who studied law; no screen names the exam
      - The rule must stay true in plain words: legítima defesa needs an unjust aggression that is current or imminent, against one's own or another's right, repelled with the necessary means used moderately (art. 25 do Código Penal). Simplifying it to "anyone attacked can react" or dropping "atual ou iminente" or the moderation would make it false, and the plan keeps every requirement
      - The plan reaches the rule another way than the map's list of requirements, such as one case run on a timeline (before, during and after the aggression) or the requirements tested one by one on a single story where only one changes, and the tempting wrong answer is revenge after the aggression ended or a reaction out of proportion
      - The check that separates two ideas tells legítima defesa from estado de necessidade (a danger not caused by a person's unjust aggression) or from an excess the agent answers for
      - No brief cites an article, paragraph or item number the plan isn't sure of
    `,
    id: "pt-legitima-defesa-oab",
    language: "pt",
    lessonCanDo: "Reconhecer quando há legítima defesa",
    lessonDescription:
      "Os requisitos da legítima defesa e os casos em que a reação deixa de ser lícita.",
    lessonTitle: "Legítima defesa",
    level: "intermediate",
    secondTake: {
      firstLessonMap: {
        ideas: [
          {
            label: "O que é",
            text: "Legítima defesa é repelir injusta agressão, atual ou iminente, a direito seu ou de outrem, usando moderadamente os meios necessários.",
          },
          {
            label: "Agressão injusta",
            text: "A agressão precisa ser contrária ao direito; reagir a uma prisão legal não é legítima defesa.",
          },
          {
            label: "Atual ou iminente",
            text: "A agressão está acontecendo ou prestes a acontecer; depois que acabou, a reação é vingança.",
          },
          {
            label: "Moderação",
            text: "Os meios são os necessários e usados sem exagero; o que passa disso é excesso punível.",
          },
        ],
        shape: "hub",
      },
      wrongAnswers: [
        {
          answer: "Há legítima defesa, porque Carlos tinha sido agredido.",
          question:
            "Carlos é agredido por Pedro, que vai embora. Uma hora depois, Carlos o encontra e o fere. Há legítima defesa?",
          reason:
            "A agressão já tinha acabado: sem agressão atual ou iminente, a reação é vingança.",
        },
        {
          answer: "Há legítima defesa, porque o furto é uma agressão injusta.",
          question:
            "Um homem atira e mata um adolescente desarmado que fugia com uma fruta da sua banca. Há legítima defesa?",
          reason:
            "Há agressão injusta ao patrimônio, mas o meio é desproporcional: falta a moderação.",
        },
        {
          answer: "Legítima defesa.",
          question:
            "Para salvar o filho de um incêndio, Ana arromba a porta do vizinho. Qual excludente se aplica?",
          reason: "O perigo veio do fogo, não de uma agressão humana: é estado de necessidade.",
        },
      ],
    },
    skills: ["Reconhecer os requisitos da legítima defesa"],
  }),
  secondTakeCase({
    chapterTitle: "The Civil War",
    courseTitle: "US History",
    expectations: `
      - MUST be in US English
      - The simplification "the Emancipation Proclamation freed all enslaved people in the United States" is false and the plan never states it: the Proclamation (January 1, 1863) declared free the enslaved people in the Confederate states still in rebellion, left slavery in place in the loyal border states, and freedom reached people as Union armies advanced; the 13th Amendment (ratified December 1865) abolished slavery nationwide
      - The plan reaches the idea another way than the map's statements, such as a map or a table of places (a border state, a rebel state, an occupied area) asked one by one, or one person's story in a border state and one in a rebel state, and keeps the Proclamation and the 13th Amendment apart
      - The check that separates two ideas tells what the Proclamation did from what the 13th Amendment did
      - Every date, place and fact is right
      - A regression to avoid (first run, 26 Nov 2026): a screen on Black men joining the Union army, a point of the first lesson the wrong answers never raise
    `,
    id: "en-emancipation-proclamation",
    language: "en",
    lessonCanDo: "Explain what the Emancipation Proclamation did and didn't do",
    lessonDescription:
      "What the Emancipation Proclamation changed in 1863, where it applied and how slavery finally ended.",
    lessonTitle: "The Emancipation Proclamation",
    level: "intermediate",
    secondTake: {
      firstLessonMap: {
        ideas: [
          {
            label: "A war measure",
            text: "Lincoln issued the Emancipation Proclamation on January 1, 1863, as commander in chief during the Civil War.",
          },
          {
            label: "Where it applied",
            text: "It declared free the enslaved people in the states in rebellion against the Union.",
          },
          {
            label: "What changed",
            text: "It made ending slavery a goal of the war and let Black men join the Union army.",
          },
        ],
        shape: "hub",
      },
      wrongAnswers: [
        {
          answer: "Yes, the Proclamation freed every enslaved person in the country.",
          question:
            "In 1863, an enslaved man lives in Kentucky, a state that stayed in the Union. Did the Proclamation free him?",
          reason:
            "The Proclamation applied only to the states in rebellion; Kentucky stayed loyal, so slavery remained legal there.",
        },
        {
          answer: "The Emancipation Proclamation.",
          question: "What ended slavery everywhere in the United States?",
          reason: "The 13th Amendment, ratified in December 1865, abolished slavery nationwide.",
        },
        {
          answer: "Everyone it covered was free on January 1, 1863.",
          question: "When did enslaved people in Texas learn they were free?",
          reason:
            "Freedom came as Union troops arrived; in Texas, the news was enforced on June 19, 1865.",
        },
      ],
    },
    skills: ["Explain what the Emancipation Proclamation did"],
  }),
];
