import { type TestCase } from "@/lib/types";
import { type WriteLessonDraftParams } from "@zoonk/ai/tasks/v2/lesson-writer";
import { describeActivityTemplates } from "@zoonk/core/library/activities/writer-templates";
import { GLYCOLYSIS_SLIDES } from "../cite-material/material-fixtures";
import { ACTIVITY_LESSON_SPECS } from "./activity-lesson-specs";
import { PRICE_IMPACT_CHAPTER_LESSONS, PRICE_IMPACT_SPEC } from "./chapter-lesson-specs";
import { EXAM_PREP_LESSON } from "./exam-prep-lesson-spec";
import { LESSON_SPECS } from "./lesson-specs";
import { MATERIAL_LESSON_SPEC } from "./material-lesson-spec";
import { SETUP_LESSON_SPEC } from "./setup-lesson-spec";
import { SOURCED_LESSONS } from "./sourced-lesson-specs";
import { VISUAL_LESSON_SPECS } from "./visual-lesson-specs";

type LessonWriterInput = Omit<
  WriteLessonDraftParams,
  "analytics" | "model" | "reasoning" | "useFallback"
>;

/** What the workflow passes: the spec and the templates it picked, with their schemas. */
function toInput(input: Omit<LessonWriterInput, "activityTemplates">): LessonWriterInput {
  return {
    ...input,
    activityTemplates: describeActivityTemplates(
      input.spec.screens.flatMap((screen) => screen.activityTemplate ?? []),
    ),
  };
}

const SHARED_EXPECTATIONS = `
  - The output has one screen per planned screen, in order, each of a kind the plan allows, then the summary card (one sentence per idea)
  - A \`hookGuess\` is a guess that doesn't count: one \`reveal\` answers whatever the learner picks, so its options have no reasons by design; judge the reveal instead
  - Calculations written as \`mathCheck\` are data: code turns them into options, so judge the question, the math and the reasons, not option formatting
  - Activities are JSON inside \`content\`; code validates the fields, so judge whether the activity makes the learner do something that shows the screen's idea
  - Image prompts are only requests; judge whether the requested picture would teach, and whether a question about a picture names everything its answer depends on
  - Charts and timelines in \`visual\` are drawn by the app from their data; judge whether the data is right and matches the text
  - Don't evaluate JSON formatting
`;

/** The activity cases come first, so a small `--limit` run still checks the activities code runs. */
export const TEST_CASES: TestCase<never, LessonWriterInput>[] = [
  {
    expectations: `
      - MUST be in US English, for beginners
      - The findError activity is an AI assistant's answer (\`author: "ai"\`) whose one mistake is in step 2 as the brief says: a solution ("show the fee on the home screen") taken as the goal; the steps after it build on it, and the last step is never the wrong one
      - Every situation happens in a product team and its app (food delivery, banking), never at a bakery or a market; people and towns come from CAST
      - No reason or reveal points at an option by its place ("the second one", "option B"): each names the option by what it says
      - The checks and the application each ask something new

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-ux-goals-spot-ai",
    userInput: toInput({
      chapterTitle: "UX goals and outcomes",
      courseTitle: "UX Design",
      language: "en",
      level: "beginner",
      spec: ACTIVITY_LESSON_SPECS["en-ux-goals-spot-ai"],
    }),
  },
  {
    expectations: `
      - MUST be in US English, for beginners
      - The key's order is explained (broadest feature first) before the learner walks it
      - The decision tree's case is the leaf the plan describes (long needles in bundles of two) and walking its answers reaches pine; the questions follow the explanation's key
      - The activity asks for a picture of the case in its \`image\`, whose \`alt\` describes what the learner must look at (needles, bundles) without naming the tree
      - Screens without a planned Visual have no image
      - The check uses the planned trap (asking about lobes first), and the application stays on the same key

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-tree-key-beginner",
    userInput: toInput({
      chapterTitle: "Trees and plants",
      courseTitle: "Nature around you",
      language: "en",
      level: "beginner",
      spec: ACTIVITY_LESSON_SPECS["en-tree-key-beginner"],
    }),
  },
  {
    expectations: `
      - MUST be in US English, for beginners who have written a line of Python but no loops yet
      - range(start, stop) is explained as stopping before stop, with the count being stop minus start, before the learner is asked to use it
      - The code runner's starter loop really stops one number early, the solution changes only the loop line, and the expected output is exactly what the solution prints (1 to 5, one per line)
      - The runner's mistakes give feedback on what each likely wrong output means (0 to 4, or stopping at 4)
      - Checks use the classic trap of counting the stop value, and the countdown application keeps the same rule

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-python-range-beginner",
    userInput: toInput({
      chapterTitle: "Loops",
      courseTitle: "Python programming",
      language: "en",
      level: "beginner",
      spec: ACTIVITY_LESSON_SPECS["en-python-range-beginner"],
    }),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for beginners
      - Atria receive and ventricles pump; the right side sends blood to the lungs and the left side to the whole body; the septum keeps the two sides apart
      - The labeled diagram uses the checked heart diagram and its part ids, with labels in Portuguese, and its feedback explains the left-right mix-up of a heart seen from the front
      - The check about which chamber pumps to the body uses the right-ventricle trap and explains the thicker wall of the left ventricle
      - The application about a hole in the septum follows from what the lesson taught

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-camaras-do-coracao-beginner",
    userInput: toInput({
      chapterTitle: "Sistema circulatório",
      courseTitle: "Biologia",
      language: "pt",
      level: "beginner",
      spec: ACTIVITY_LESSON_SPECS["pt-camaras-do-coracao-beginner"],
    }),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for a beginner studying for a school test from their teacher's slides (MATERIAL)
      - Teaches what the slides say, with their terms, numbers and memory aids: 2 ATP spent in the investment phase (the "empréstimo" comparison), 4 ATP and 2 NADH produced, a net of 2 ATP per glucose, glycolysis in the cytoplasm
      - Nothing contradicts the slides, and nothing beyond them is presented as needed for the test
      - The checks use the slides' exam traps (answering 4 instead of 2; placing glycolysis in the mitochondria), with a reason on every option
      - No pictures (every image is null): the slides have their own

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-glicolise-from-slides",
    userInput: toInput({
      chapterTitle: "Glicólise",
      courseTitle: "Prova de biologia: respiração celular",
      language: "pt",
      level: "beginner",
      material: GLYCOLYSIS_SLIDES,
      spec: MATERIAL_LESSON_SPEC,
    }),
  },
  {
    expectations: `
      - MUST be in US English, for a beginner
      - The hook uses the planned surprise (a price that drops 50% and doesn't come back with a 50% rise) as a guess, with no introduction
      - Percent change is explained as change divided by the starting value, concretely with dollars, before any formula; the formula, if any, is explained piece by piece
      - Worked examples show every step with correct arithmetic, and the check after each one is a similar problem with less help
      - Checks include the classic trap of dividing by the new value, and every option's reason explains why it's tempting and why it's wrong
      - The estimate-then-reveal activity makes the learner commit to a guess before the math, tied to the screen's idea
      - The application is a realistic case (rent, salary, a sale) in a place the learner recognizes
      - \`exampleLineIdea\` is set on the explanation that compares a change with the starting value, saying what in a learner's life it could connect to (a price they pay going up or down); a second one only on an explanation whose idea would need a different moment of their life, and none on the others

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-percent-change-beginner",
    userInput: toInput({
      chapterTitle: "Fractions and percentages",
      courseTitle: "Mathematics",
      language: "en",
      level: "beginner",
      spec: LESSON_SPECS["en-percent-change-beginner"],
    }),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for intermediate learners who partly know the idea (question first)
      - The first check after the hook is something learners can try before the explanation, and the next explanation builds on it
      - Telling direct from inverse proportion comes before setting up the rule of three, with an everyday comparison (more workers, fewer days)
      - Worked examples of a direct and an inverse case, each followed by a similar check; numbers must be right
      - Checks name the classic trap of treating an inverse proportion as direct
      - Everyday Brazilian contexts (obra, receita, combustível, reais), not textbook abstractions

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-regra-de-tres-intermediate",
    userInput: toInput({
      chapterTitle: "Razão e proporção",
      courseTitle: "Matemática",
      language: "pt",
      level: "intermediate",
      spec: LESSON_SPECS["pt-regra-de-tres-intermediate"],
    }),
  },
  {
    expectations: `
      - MUST be in US English, for advanced learners
      - The derivation is complete and correct: the time-independent equation inside the box, boundary conditions ψ(0) = ψ(L) = 0, sine solutions, kL = nπ, and E_n = n²π²ħ²/(2mL²)
      - Standing waves on a string come before the notation, and each new term (wave function, boundary condition, quantized) is explained when it first appears
      - Notation is consistent across screens (ħ, m, L, n), and the worked derivation reveals one move per step
      - The slider graph shows how energy depends on n or L, with a check about what the learner saw
      - Checks need real understanding (why n = 0 isn't allowed, how E scales with L), with reasons for every option

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-particle-in-a-box-advanced",
    userInput: toInput({
      chapterTitle: "The Schrödinger equation",
      courseTitle: "Quantum mechanics",
      language: "en",
      level: "advanced",
      spec: LESSON_SPECS["en-particle-in-a-box-advanced"],
    }),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for a curious adult (overview)
      - No formulas, equations or notation anywhere; the idea is told as a story with everyday comparisons (a cloud, a blurred fan)
      - Physically correct: the old orbit picture is wrong because a circling charge would radiate and spiral in; the electron is described by a cloud of where it's likely to be, and confinement costs energy
      - Checks are light and fun but still make the learner use the idea, with reasons for every option
      - The application ties the idea to something real (atoms and matter being stable, the learner's own body existing)

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-eletron-nucleo-overview",
    userInput: toInput({
      chapterTitle: "O átomo por dentro",
      courseTitle: "Física quântica",
      language: "pt",
      level: "overview",
      spec: LESSON_SPECS["pt-eletron-nucleo-overview"],
    }),
  },
  {
    expectations: `
      - MUST be in US English, for a beginner setting up Python on Windows before a chapter that uses it
      - The hook says in one sentence when these steps were written, as a month and year (the day the lesson was written, 2026 or later), and that screens may look a little different later; no other screen needs the date
      - The steps are right for Windows: the free installer from python.org, ticking "Add python.exe to PATH", opening Terminal from the Start menu, python --version, then a print line and exit()
      - PATH is explained in everyday words when it first appears
      - Checks ask what went wrong or what a result means, with the planned tempting wrong answers and a reason on every option
      - It stays on the setup: no lessons on writing Python itself

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-set-up-python-windows",
    userInput: toInput({
      chapterTitle: "Set up Python on Windows",
      courseTitle: "Set up Python on Windows",
      language: "en",
      level: "beginner",
      spec: SETUP_LESSON_SPEC,
    }),
  },
  {
    expectations: `
      - MUST be in US English, for a beginner, with a US setting (dollars, US cities, US names)
      - Every deadline matches SOURCES exactly: the 2025 return is due April 15, 2026; Form 4868 by April 15 extends filing to October 15, 2026; an extension never delays paying, which stays April 15, 2026
      - The check uses the planned trap (paying on October 15) and each reason says why it's tempting and wrong
      - The lesson teaches in its own words and order, not by copying the IRS page
      - The application with the Denver freelancer asks what to do and by when, without handing over the answer

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-tax-deadlines-sourced",
    userInput: toInput(SOURCED_LESSONS["en-tax-deadlines"]),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for a beginner, with Brazilian names, places and money (reais, a prefeitura in a Brazilian city)
      - The stability rule matches SOURCES (Constituição, art. 41): three years of effective service AND approval in the special performance evaluation by a commission; never 24 months or 2 years, even though an old statute says so
      - For misconduct or poor performance, the ways a stable servant loses the post are the three the article lists, each with the right to a defense; the lesson never claims these are the only ways in all cases (the Constitution also allows cuts when personnel spending exceeds its limit)
      - "Estabilidade" and "processo administrativo" are explained in everyday words when they first appear
      - The check uses the planned trap (thinking time alone is enough) with a reason on every option

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-estabilidade-sourced",
    userInput: toInput(SOURCED_LESSONS["pt-estabilidade"]),
  },
  {
    expectations: `
      - MUST be in US English, overview level: plain words and stories, no formulas
      - The plan's $20, $21 and $19 prices are the ones the earlier lesson "Why stock prices change" used, so the lesson uses new prices instead (share counts may stay), consistently on every screen, and still teaches the same idea (an order uses up the shares at one price, then reaches the next price)
      - What sets a trade price, liquidity and the spread get at most a short reminder in everyday words, never a full explanation again
      - Checks ask something new each time, with a reason on every option, and the application is a realistic situation in a named investing app

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-price-impact-chapter-siblings",
    userInput: toInput({
      chapterLessons: PRICE_IMPACT_CHAPTER_LESSONS,
      chapterTitle: "Prices and trading costs",
      courseTitle: "How the stock market works",
      language: "en",
      level: "overview",
      spec: PRICE_IMPACT_SPEC,
    }),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for a beginner studying for a school test from their teacher's slides (MATERIAL)
      - HELD_BACK_DRAFTS lists why earlier drafts were held back, and this draft has none of those problems: the net of glycolysis is 2 ATP per glucose (4 produced minus 2 spent), NADH is never counted as ATP, and glycolysis happens in the cytoplasm, never in the mitochondria
      - It's a whole new lesson from the plan, not a patch: every planned screen is there and teaches what its brief says, with the slides' terms, numbers and memory aids
      - The checks still use the slides' exam traps (answering 4 instead of 2; placing glycolysis in the mitochondria), with a reason on every option
      - No pictures (every image is null): the slides have their own

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-glicolise-redraft-after-hold",
    userInput: toInput({
      chapterTitle: "Glicólise",
      courseTitle: "Prova de biologia: respiração celular",
      heldBackProblems: [
        {
          problem:
            "The explanation counts the 2 NADH as ATP and gives a net of 4 ATP per glucose; the slides give 4 − 2 = 2 ATP, and NADH carries electrons to the respiratory chain. Fix: Give the net as 2 ATP and say what NADH does.",
          screen: 2,
        },
        {
          problem:
            "The check marks 'na mitocôndria' as where glycolysis happens; the slides say the cytoplasm, and the mitochondria only come in the Krebs cycle. Fix: Mark the cytoplasm as correct.",
          screen: 4,
        },
      ],
      language: "pt",
      level: "beginner",
      material: GLYCOLYSIS_SLIDES,
      spec: MATERIAL_LESSON_SPEC,
    }),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for beginners preparing for a concurso's Portuguese test
      - Every question about a picture (the guess, the check and the application) has an \`image\` whose prompt names what the answer depends on, and its text says "a imagem" without describing what the picture shows (no "Na imagem, Otávio está parado…")
      - The two scenes of the application are one picture with both side by side, labeled 1 and 2
      - Captions and quoted words are in _italics_, never between « » or << >>
      - Checks ask which caption fits, with the tempting wrong caption the brief names and a reason on every option
      - Every explanation has \`exampleLineIdea\` null: matching a caption to a picture is an everyday reading skill that a sentence about the learner's life wouldn't make clearer

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-imagens-e-legendas-visual",
    userInput: toInput({
      chapterTitle: "Interpretação de imagens",
      courseTitle: "Língua Portuguesa",
      language: "pt",
      level: "beginner",
      spec: VISUAL_LESSON_SPECS["pt-imagens-e-legendas-beginner"],
    }),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for beginners
      - The letters data is a real Markdown table in the screen's text or context (header row, \`---\` row, one row per line), never written inline as "Maio → 40; Junho → 30"
      - The bar chart of letters answered is a \`visual\` of kind chart, \`bar\`, with May, June and July and their values (35, 36, 40), and the check's numbers match it
      - The bikes table of the application is a Markdown table too
      - No screen has both an image and a visual, and no screen describes a table or chart in words instead of showing it

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-tabela-e-grafico-visual",
    userInput: toInput({
      chapterTitle: "Interpretação de dados",
      courseTitle: "Raciocínio lógico",
      language: "pt",
      level: "beginner",
      spec: VISUAL_LESSON_SPECS["pt-tabela-e-grafico-beginner"],
    }),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for beginners
      - The application compares two drawings as one \`image\` with both in it, labeled 1 and 2, and its options name them by those labels
      - The guess and the check don't offer three drawings or charts as options: each shows one chart as a \`visual\` and asks about it (which bar is wrong, whether it matches), or asks in words; no option is labeled as a drawing or chart the screen doesn't show
      - The explanation with 2, 5 and 7 shows a bar chart \`visual\` with those values
      - The explanation that compares two versions of the same data (bars standing with cramped names, bars lying with full names) shows them as one \`image\` with both, labeled 1 and 2, instead of only describing them
      - No screen has both an image and a visual, and nothing is drawn with characters

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-graficos-de-barras-visual",
    userInput: toInput({
      chapterTitle: "Comparações visuais",
      courseTitle: "Excel e análise de dados",
      language: "pt",
      level: "beginner",
      spec: VISUAL_LESSON_SPECS["pt-graficos-de-barras-beginner"],
    }),
  },
  {
    expectations: `
      - MUST be in US English, for beginners
      - The balance growing year by year ($1,000, $1,100, $1,210, $1,331) is data the app draws: the screen planned with a picture of the curve shows a \`visual\` of kind chart (\`line\`) with those exact values and \`image\` null, never a picture request for it
      - The screen that compares simple and compound interest after 3 years shows the two balances ($1,300 and $1,331) as a table or chart, not a picture
      - No other screen has a picture: the words are clear on their own

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-compound-interest-native-visual",
    userInput: toInput({
      chapterTitle: "Saving and investing",
      courseTitle: "Personal finance",
      language: "en",
      level: "beginner",
      spec: VISUAL_LESSON_SPECS["en-compound-interest-beginner"],
    }),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Written for candidates of the exam in EXAMS, who studied law: no screen explains what the OAB, the Constitution, a lawyer, the Estatuto or human rights are, and the OAB isn't introduced as "a entidade dos advogados"
      - The finalidades match art. 44 of Lei 8.906/1994 and are cited as such: I (defend the Constitution, the legal order of the democratic rule of law, human rights and social justice, and pursue the good application of laws, the quick administration of justice and the improvement of legal culture and institutions) and II (promote, exclusively, the representation, defense, selection and discipline of lawyers throughout Brazil); nothing says the OAB judges cases or that its exclusivity covers the finalidades of item I
      - Every check has 3 or 4 options whose wrong ones are confusions law candidates make (a finalidade of item I taken as corporate or exclusive, exclusivity read as limiting the OAB to lawyers, cobrar celeridade taken as a power to decide), each as plausible and as long as the right one; no absurd option ("toda pessoa detida é advogada")
      - No screen names the exam, its board or its notice ("Exame de Ordem", "1ª fase", "FGV", "edital")

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-finalidades-oab-exam-prep",
    userInput: toInput(EXAM_PREP_LESSON),
  },
];
