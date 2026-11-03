import { type TestCase } from "@/lib/types";
import { type WriteLessonDraftParams } from "@zoonk/ai/tasks/lesson-writer";
import { describeActivityTemplates } from "@zoonk/core/library/activities/writer-templates";
import { GLYCOLYSIS_SLIDES } from "../cite-material/material-fixtures";
import { ACTIVITY_LESSON_SPECS } from "./activity-lesson-specs";
import { BUDGET_LESSON_SPECS } from "./budget-lesson-specs";
import { PRICE_IMPACT_CHAPTER_LESSONS, PRICE_IMPACT_SPEC } from "./chapter-lesson-specs";
import { EXAM_PREP_LESSON } from "./exam-prep-lesson-spec";
import { EXPLORE_LESSON_SPECS } from "./explore-lesson-specs";
import { LESSON_SPECS } from "./lesson-specs";
import { MATERIAL_LESSON_SPEC } from "./material-lesson-spec";
import { NOVICE_LESSON_SPECS } from "./novice-lesson-specs";
import { SCIENTIFIC_NOTATION_SPEC } from "./number-lesson-spec";
import { SETUP_LESSON_SPEC } from "./setup-lesson-spec";
import { SOURCED_LESSONS } from "./sourced-lesson-specs";
import { VISUAL_LESSON_SPECS } from "./visual-lesson-specs";
import { WALK_LESSONS } from "./walk-lesson-specs";

type LessonWriterInput = Omit<
  WriteLessonDraftParams,
  "analytics" | "model" | "reasoning" | "useFallback"
>;

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
  - At every level, exams and class material included, the first screen is a \`hookText\` scene with nothing to pick or type, ending on the question the lesson answers, even when its plan was a guess; no check comes before the first explanation or worked example, and the writer adds no screen the plan doesn't have, so a plan with no screen planned as a guess has no guess. A screen planned as the guess is a \`hookGuess\` that doesn't count: one \`reveal\` answers whatever the learner picks, so its options have no reasons by design; judge the reveal instead
  - Calculations written as \`mathCheck\` are data: code turns them into options, so judge the question, the math and the reasons, not option formatting
  - Activities are JSON inside \`content\`; code validates the fields, so judge whether the activity makes the learner do something that shows the screen's idea
  - Image prompts are only requests; judge whether the requested picture would teach, and whether a question about a picture names everything its answer depends on in its \`prompt\` and its \`alt\` (learners who can't see the picture answer from the alt, which never names what the question asks them to recognize)
  - Charts and timelines in \`visual\` are drawn by the app from their data; judge whether the data is right and matches the text
  - An explanation's \`explore\` is a template the app draws under the text with nothing asked, its fields as JSON in \`content\`; judge whether its fields are right and match the text
  - A question's \`basis\` names an earlier screen and quotes the sentence the app marks there after a wrong answer (code checks the quote is exact); judge whether that sentence is the one that decides the right answer, and flag a null basis on a question one earlier sentence clearly decides
  - Don't evaluate JSON formatting
`;

function budgetLesson(key: keyof typeof BUDGET_LESSON_SPECS): LessonWriterInput {
  return toInput({
    chapterTitle: "O dinheiro que entra e sai de casa",
    courseTitle: "Orçamento doméstico",
    language: "pt",
    level: "beginner",
    spec: BUDGET_LESSON_SPECS[key],
  });
}

const UNANSWERABLE_GUESS = `
  - Someone who reads only the guess's question, knowing nothing the lesson teaches, can't answer it: its setup never settles the answer by itself, and the right option is never the only one that echoes the question's words
  - The guess keeps its plan's idea, the one the next screen explains, and one wrong option is what a beginner's intuition says
`;

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
      - The keyboard activity is by ear (\`byEar\`): it plays an A minor chord (A, C, E) together without naming it, and the learner names what they heard (major or minor) with minor correct; the question never says which chord it is
      - The explanation's notes are right (C, E, G is major; C, Eb, G is minor), and the check's right answer is E dropping to Eb, with the top-note trap
      - The application's fix is B to Bb

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-major-minor-by-ear",
    userInput: toInput({
      chapterTitle: "Chords",
      courseTitle: "Music basics",
      language: "en",
      level: "beginner",
      spec: ACTIVITY_LESSON_SPECS["en-major-minor-by-ear"],
    }),
  },
  {
    expectations: `
      - MUST be in US English, for beginners
      - The combination grid crosses alleles P and p (rows) with p and p (columns), names the traits (purple dominant, white recessive), and its check gives 1 in 2 white, with the 1-in-4 trap
      - The random simulation is in chance mode: batches of 100 seeds, each white with chance 1/2, a hit of exactly 50 white, and a guess about how often that happens whose closest option (about 8%) is right, with feedback that batches spread around 50 instead of hitting it
      - The grid has 4 cells, so the learner fills it before answering whatever its check (the app's rule), and the question about the share comes after the fill
      - The application keeps 47 of 100 consistent with a 1 in 2 chance

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-pea-crosses-chance",
    userInput: toInput({
      chapterTitle: "Heredity",
      courseTitle: "Biology",
      language: "en",
      level: "beginner",
      spec: ACTIVITY_LESSON_SPECS["en-pea-crosses-chance"],
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
      - The labeled diagram's \`picture\` is the heart seen from the front with no words in it; its parts are the four chambers and the septum, each named in Portuguese with the part it marks in English, and its feedback explains the left-right mix-up of a heart seen from the front
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
      - MUST be in Brazilian Portuguese, for intermediate learners
      - The lines-and-crossing activity has a supply and a demand line with example numbers marked as an example, and its \`shift\` moves supply to the left (the bird flu), so the crossing rises to a higher price and a smaller quantity; the feedback covers moving demand instead and moving the wrong way
      - The 2022 egg prices are presented as real (about US$ 1.80 to over US$ 4 a dozen) and the activity's own numbers as an example
      - The check moves demand to the right (price and quantity both rise) with the supply trap, and the application moves the bread's supply right (price falls)

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-demanda-ovos-deslocamento",
    userInput: toInput({
      chapterTitle: "Oferta e demanda",
      courseTitle: "Economia",
      language: "pt",
      level: "intermediate",
      spec: ACTIVITY_LESSON_SPECS["pt-demanda-ovos-deslocamento"],
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
      - MUST be in Brazilian Portuguese, for a beginner learning biology as a hobby, with no exam to prepare for
      - The membrane separates the inside from the outside and controls what enters and leaves; the cytoplasm fills the space between the membrane and the genetic material and is where much of the cell's work happens; the genetic material holds the instructions
      - No screen is a \`typedAnswer\`: every check and the application are answered by picking (code flags a typed answer, since this lesson's learners take no exam that asks written answers)
      - The application keeps Iara's diagram from the brief and asks what she adds, where and why, with short options (the cytoplasm, filling the space between the membrane and the genetic material), the second-membrane trap and a reason on every option

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-partes-da-celula-hobby",
    userInput: toInput({
      chapterTitle: "A célula",
      courseTitle: "Biologia",
      language: "pt",
      level: "beginner",
      spec: LESSON_SPECS["pt-partes-da-celula-hobby"],
    }),
  },
  {
    expectations: `
      - MUST be in US English, for a beginner
      - The plan's hook is a guess, and a beginner's hook is a scene: it turns the planned surprise (a price that drops 50% and doesn't come back with a 50% rise) into a \`hookText\` of one or two sentences that ends on the question the lesson answers, with nothing to answer and no introduction
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
      - MUST be in Brazilian Portuguese, for intermediate learners who partly know the idea
      - The first explanation comes before the first check, and that check applies the comparison to new cases instead of repeating it
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
      - Every image \`alt\` stays under 160 characters and reads as a whole sentence, not cut mid-word

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
      setup: true,
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
      - The hook is a \`hookText\` scene with its picture, asking nothing; every question about a picture (the checks and the application) has an \`image\` whose prompt names what the answer depends on, and its text says "a imagem" without describing what the picture shows (no "Na imagem, Otávio está parado…")
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
      - The application compares two drawings as one \`image\` with both in it, labeled 1 and 2, and its options name them by those labels; its \`alt\` says what drawing 1 and drawing 2 each show, so a learner who can't see the picture can still answer
      - No check offers three drawings or charts as options: each shows one chart as a \`visual\` and asks about it (which bar is wrong, whether it matches), or asks in words; no option is labeled as a drawing or chart the screen doesn't show
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
      - MUST be in US English, for beginners
      - The check about the three doorways gives every option a \`picture\` (one doorway alone each, no text in the picture) and the screen no \`image\` or \`visual\`
      - Each option's \`picture.alt\` says what that doorway looks like (its arch, columns, walls or decoration) without naming its style, so it never gives the answer away; \`text\` names the style (the app shows each option's \`text\` only once the learner answers, so the question can name the style it asks for)
      - Exactly the Gothic doorway (the pointed arch) is correct, and each reason says what in the doorway's shape gives its style away
      - No other screen gives its options pictures

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-church-doorways-picture-options",
    userInput: toInput({
      chapterTitle: "Reading buildings",
      courseTitle: "Art history",
      language: "en",
      level: "beginner",
      spec: VISUAL_LESSON_SPECS["en-church-doorways-beginner"],
    }),
  },
  {
    expectations: `
      - MUST be in US English, for beginners
      - The check about the flower has an \`image\` of one flower cut in half whose \`parts\` lists the petal, stamen, stigma and ovary in English, and whose \`prompt\` asks for no labels or text
      - Its options are numbers from 1 to the number of parts, and exactly the ovary's number (its place in \`parts\`, 1 for the first) is correct; the stigma's number is among the wrong options, with a reason about the stalk it sits on
      - Its \`alt\` says where each number sits and how that spot looks, without naming the part it marks
      - No other picture numbers parts (only a check's \`image\` has \`parts\`), and no option has a \`picture\`

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-flower-parts-numbered",
    userInput: toInput({
      chapterTitle: "How plants reproduce",
      courseTitle: "Biology",
      language: "en",
      level: "beginner",
      spec: VISUAL_LESSON_SPECS["en-flower-parts-numbered"],
    }),
  },
  {
    expectations: `
      - MUST be in US English, for beginners
      - The check about the sweater's tag has an \`image\` whose \`alt\` gives the tag's words (hand wash cold, lay flat to dry), so a learner who can't see the picture can still answer
      - Since that alt gives the tag's words, the check doesn't ask what the tag says or reads: it asks what the tag means for a decision, such as how to dry the sweater after washing it, and keeps "tumble dry low" as a wrong option

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-care-tag-picture-meaning",
    userInput: toInput({
      chapterTitle: "Laundry",
      courseTitle: "Home skills",
      language: "en",
      level: "beginner",
      spec: VISUAL_LESSON_SPECS["en-laundry-care-labels-beginner"],
    }),
  },
  {
    expectations: `
      - MUST be in US English, for beginners
      - The second screen's \`explore\` is a formulaModel whose slider is the yearly rate from 0 to 12 (starting at 5) and whose output formula gives the balance of $1,000 after 20 years, 1000 * (1 + rate/100)^20; its labels and units fit the text
      - Every number in the text matches what that formula gives (about $2,191 at 4% and $4,661 at 8%)
      - No screen has a picture

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-compound-growth-explore",
    userInput: toInput({
      chapterTitle: "Saving and investing",
      courseTitle: "Personal finance",
      language: "en",
      level: "beginner",
      spec: EXPLORE_LESSON_SPECS["en-compound-growth-explore"],
    }),
  },
  {
    expectations: `
      - MUST be in US English, for beginners
      - The second screen's \`explore\` is a labeledDiagram whose \`picture\` is the heart seen from the front with no words in it, and whose parts are the right atrium, left atrium, right ventricle, left ventricle and septum, each named as the text names it
      - The text explains that the heart is seen from the front, so its right side is on the viewer's left
      - No screen has an \`image\`: the labeled diagram's picture is its own

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-heart-chambers-explore",
    userInput: toInput({
      chapterTitle: "The circulatory system",
      courseTitle: "Human biology",
      language: "en",
      level: "beginner",
      spec: EXPLORE_LESSON_SPECS["en-heart-chambers-explore"],
    }),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - The second screen's \`explore\` is a processOrder with the five steps in their true order (light absorbed by chlorophyll, water split releasing oxygen, energy stored in ATP and NADPH, the Calvin cycle fixing CO2 into sugar, sugar stored as starch), each step after the first with why it comes there
      - No screen has a picture

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-fotossintese-explore",
    userInput: toInput({
      chapterTitle: "Fotossíntese",
      courseTitle: "Biologia",
      language: "pt",
      level: "beginner",
      spec: EXPLORE_LESSON_SPECS["pt-fotossintese-explore"],
    }),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - The second screen's \`explore\` is a mapExplorer on the roman-empire-117 base map with Roma, Cartago, Alexandria, Londinium and Antioquia at their real coordinates (Rome about 41.9 N 12.5 E, Carthage 36.9 N 10.3 E, Alexandria 31.2 N 29.9 E, London 51.5 N 0.1 W, Antioch 36.2 N 36.2 E), each revealing something true about the empire, and its data cites a real source
      - No screen has a picture

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-imperio-romano-explore",
    userInput: toInput({
      chapterTitle: "Roma antiga",
      courseTitle: "História",
      language: "pt",
      level: "beginner",
      spec: EXPLORE_LESSON_SPECS["pt-imperio-romano-explore"],
    }),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Written for candidates of the exam in EXAMS, who studied law: no screen explains what the OAB, the Constitution, a lawyer, the Estatuto or human rights are, and the OAB isn't introduced as "a entidade dos advogados"
      - The finalidades match art. 44 of Lei 8.906/1994 and are cited as such: I (defend the Constitution, the legal order of the democratic rule of law, human rights and social justice, and pursue the good application of laws, the quick administration of justice and the improvement of legal culture and institutions) and II (promote, exclusively, the representation, defense, selection and discipline of lawyers throughout Brazil); nothing says the OAB judges cases or that its exclusivity covers the finalidades of item I
      - Every check has 3 or 4 options whose wrong ones are confusions law candidates make (a finalidade of item I taken as corporate or exclusive, exclusivity read as limiting the OAB to lawyers, cobrar celeridade taken as a power to decide), each as plausible and as long as the right one; no absurd option ("toda pessoa detida é advogada")
      - No screen names the exam, its board or its notice ("Exame de Ordem", "1ª fase", "FGV", "edital")
      - The lesson opens on Lorena's scene at the fórum with nothing to answer, and the first check comes after the first explanation; the guess about her two proposals comes right after that explanation

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-finalidades-oab-exam-prep",
    userInput: toInput(EXAM_PREP_LESSON),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for candidates of the exam in EXAMS, who are finishing secondary school
      - The lesson opens on Nayara's chart as a scene with nothing to answer; the guess comes right after the first explanation, with at most 4 options
      - The guess's answer agrees with its own chart and with the later screens: each of 1.000, 120 and 14 units is about 12% of the one before, so the group that eats the fish has about 1 or 2 units. The plan's 10 units (over 70% of 14) is never marked right or called a possible value, and nothing marked right rests on a fixed 10% rule, which a later screen says not to apply automatically
      - The screens with 900, 108 and 15 units give the shares as 12% and about 14% and say the share varies with what is eaten and the energy organisms use
      - The checks use the planned traps (energy destroyed in cellular respiration; all the food's energy passing intact to the next consumer; choosing the predators because they're at the top), with a reason on every option
      - The planned bar charts are \`visual\`s of kind chart (\`bar\`) with the planned values, and every number in the text matches them
      - No screen names the exam, its board or its notice

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-piramide-energia-guess",
    userInput: toInput(WALK_LESSONS["pt-piramide-energia"]),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for candidates of the exam in EXAMS, who are finishing secondary school
      - The categorize activity's \`prompt\` says what to sort and by what (the records into the animal groups by their body traits), never how to work the screen: no "arraste", "toque", "clique" or any other gesture, although its brief asks the learner to drag each record
      - The categorize activity sorts the four records into poríferos, cnidários, artrópodes and vertebrados by body traits, as its brief says
      - The lesson opens on Edson's tide-pool scene with nothing to answer; the guess about his crab comes right after the first explanation, with 4 options and camarão right, and its reveal doesn't explain the criterion yet
      - The bat-and-dragonfly check comes after the screens that explain arthropods and vertebrates, and no check asks about a group before a screen explains it
      - No screen names the exam, its board or its notice

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-grupos-de-animais-activity-prompt",
    userInput: toInput(WALK_LESSONS["pt-grupos-de-animais"]),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for candidates of the exam in EXAMS, who are finishing secondary school
      - The lesson opens on Renan's scene with sensors A and C in a Markdown table, asking with no options whether both are equally reliable; no check comes before the precision explanation
      - The guess comes right after that explanation and asks what the third sensor (51,0; 51,0; 51,1 mm) is, with "preciso, mas não exato" right and a reveal that doesn't explain why yet
      - A guess has at most 4 options, and the right one is among them
      - Precision is how close the readings are to each other and accuracy how close their center is to the reference; the checks use the planned traps (the more precise multimeter taken as the more accurate one; the whole spread taken as the margin)
      - Every center is the midpoint of the extreme readings and every margin half the distance between them: 8,2 ± 0,2 cm, 18,8 ± 0,2 mm, 11,9 ± 0,2 cm, 32,0 ± 0,4 °C, and in the application A 49,6 ± 0,1 mm and B 50,0 ± 0,2 mm, with B meeting both conditions
      - No screen names the exam, its board or its notice

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-precisao-sensores",
    userInput: toInput(WALK_LESSONS["pt-precisao-sensores"]),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for intermediate learners, explanation first
      - Every number is written the Brazilian way: a decimal comma (3,844), thousands grouped with a dot (384.400; 203.000.000 or 203 milhões), and inside LaTeX math the decimal comma braced (3{,}844 \\times 10^{5}) so it reads as one number
      - The form a × 10ⁿ, with a from 1 to less than 10, is explained by counting how far the comma moves and which way, for large and small numbers
      - Worked examples and checks have the planned numbers and exponents right, and the checks use the planned traps (a decimal outside 1 to 10, the exponent's sign flipped, exponents multiplied instead of added)

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-notacao-cientifica-numbers",
    userInput: toInput({
      chapterTitle: "Potências e notação científica",
      courseTitle: "Matemática",
      language: "pt",
      level: "intermediate",
      spec: SCIENTIFIC_NOTATION_SPEC,
    }),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for total beginners
      - The plan's hook is a guess, and a beginner's hook is a scene: a \`hookText\` showing the pond in one or two everyday sentences that end on an open question the lesson answers (how its living things fit together), never the guess's choices in words, and its picture of the pond
      - Each explanation has at most one term in bold, two or three short sentences: on the screen about espécie, only espécie is bold, and organismo, taught in an earlier lesson, is recalled in plain words
      - A species is living beings alike enough to reproduce together and have fertile offspring, never just "related living beings"
      - Every picture is one scene of the same pond, its \`alt\` describing that same scene, the people in it adults
      - One person at most carries the lesson (the plan names Murilo only in the application)
      - The summary card is \`nested\` (organismo inside população inside comunidade inside ecossistema, smallest first), each idea with a short label and a sentence that names its level and reads on its own

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-niveis-ecologicos-one-term",
    userInput: toInput({
      chapterLessons: [
        {
          canDo: "Relacionar células, tecidos, órgãos e organismos",
          ideas: [
            "A célula é uma pequena unidade viva que compõe os seres vivos; um organismo é um ser vivo inteiro.",
          ],
          order: "before",
          title: "Organização dos organismos",
        },
      ],
      chapterTitle: "Organização da vida",
      courseTitle: "Biologia",
      language: "pt",
      level: "beginner",
      spec: NOVICE_LESSON_SPECS["pt-niveis-ecologicos-beginner"],
    }),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for total beginners in accounting
      - The plan's hook is a guess, and a beginner's hook is a scene: a \`hookText\` about Davi's workshop that ends on an open question the lesson answers, never the guess's choices in words, and no term the lesson explains
      - The first explanation, whose brief packs a definition, a caveat and a formula to explore, is two or three short sentences with one bold term (patrimônio líquido); bens, direitos and obrigações are recalled in plain words, never bold or defined again; the caveat (a book value, not a sale price) stays, briefly
      - Every number in the worked example, the checks, the explore and the application matches the plan and adds up
      - Options are short; the why goes in each option's reason
      - Every check before the application is decided by a sentence an earlier screen states, quoted in its \`basis\`, never an idea no screen taught (a regression: an earlier lesson's checks asked about ideas not taught)
      - Money is written in one format on every screen (never R$ 2.000 on one and R$ 2.000,00 on another)
      - The summary card is a \`hub\` whose sentences each name their subject ("O patrimônio líquido é…"), never a fragment that only reads with its label

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-patrimonio-liquido-dense-brief",
    userInput: toInput({
      chapterTitle: "Elementos do patrimônio",
      courseTitle: "Contabilidade",
      language: "pt",
      level: "beginner",
      spec: NOVICE_LESSON_SPECS["pt-patrimonio-liquido-beginner"],
    }),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for an overview: plain words, light checks
      - The plan's hook is a guess, and an overview's hook is a scene: a \`hookText\` about Igor's repair work in one or two sentences that ends on the question the lesson answers, with nothing to answer
      - The check about a weekly payment whose amount changes keeps its learning move and its tempting wrong answer (the amount changing makes it irregular), with short options; an option may carry a short reason ("Não, porque o valor muda") only because choosing the right explanation is what this check practices, and each reason is one short sentence
      - The application keeps its two choices and their meaning, as short options
      - The summary card is a \`hub\` whose sentences each name their subject ("Uma receita regular…"), never a fragment such as "Repete-se em intervalos definidos"

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-receitas-short-options",
    userInput: toInput({
      chapterTitle: "Entradas e saídas de dinheiro",
      courseTitle: "Educação Financeira",
      language: "pt",
      level: "overview",
      spec: NOVICE_LESSON_SPECS["pt-receitas-regulares-overview"],
    }),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for total beginners
      - Every wrong option is a mistake a beginner could really make. The plan names "a cor preferida dos clientes" as a tempting answer on the owner's check: no learner would pick that, so the screen offers plausible confusions instead (records that don't show money coming in and going out, such as a customer list)
      - A wrong option's reason reads naturally: it may speak about the option itself in plain words ("Uma lista de clientes não mostra o dinheiro que entra e sai.") instead of telling "você" what they did
      - "Autoridade fiscal", "obrigações tributárias" and "tributos" are each explained in everyday words (the government office that checks taxes, the taxes a business must pay) or replaced by everyday words; no screen uses a term it doesn't explain
      - At most one term in bold per explanation
      - Map labels never repeat the lesson's title; each names what its idea adds

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-usuarios-contabilidade-plausible-options",
    userInput: toInput({
      chapterTitle: "Informação contábil e responsabilidade",
      courseTitle: "Contabilidade geral",
      language: "pt",
      level: "beginner",
      spec: NOVICE_LESSON_SPECS["pt-usuarios-contabilidade-beginner"],
    }),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for total beginners
      - "Retirar lucros" and "participação" are explained in everyday words where they first appear (taking out part of what the business earned; the owner's share in the business), never used as if known
      - The hard cases each get their own clear screen: a personal bill paid by the business with a promise to pay back is a value to receive, a profit withdrawal is not, a personal debt doesn't become the business's
      - At most one term in bold per explanation
      - Map labels never repeat the lesson's title ("Entidade contábil"); each names what its idea adds, and every sentence names its subject

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-entidade-contabil-terms-explained",
    userInput: toInput({
      chapterTitle: "Informação contábil e responsabilidade",
      courseTitle: "Contabilidade geral",
      language: "pt",
      level: "beginner",
      spec: NOVICE_LESSON_SPECS["pt-entidade-contabil-beginner"],
    }),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for total beginners
      - Ativo, passivo and patrimônio líquido were taught in the chapter's earlier lessons: the first explanation recalls them in a few plain words and its table, never three definitions in bold on one screen; the new term (equação patrimonial) is the only one in bold, on its own screen
      - Every number in the tables, the formula to explore and the checks matches the plan and adds up
      - Map labels never repeat the lesson's title; each names what its idea adds

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-equacao-patrimonial-one-new-term",
    userInput: toInput({
      chapterLessons: [
        {
          canDo: "Identificar bens e direitos controlados por uma entidade",
          order: "before",
          title: "Bens, direitos e ativos",
        },
        {
          canDo: "Identificar obrigações presentes de uma entidade",
          order: "before",
          title: "Obrigações e passivos",
        },
        {
          canDo: "Calcular a participação residual dos proprietários",
          order: "before",
          title: "Patrimônio líquido",
        },
      ],
      chapterTitle: "Patrimônio e equação patrimonial",
      courseTitle: "Contabilidade geral",
      language: "pt",
      level: "beginner",
      spec: NOVICE_LESSON_SPECS["pt-equacao-patrimonial-beginner"],
    }),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for total beginners
      ${UNANSWERABLE_GUESS}
      - The plan's guess answers itself: two offers with the same gross pay, one withholding R$ 300 and the other nothing, asking which leaves more. Writing it as planned fails; the written guess asks about the same idea in a way its own setup doesn't settle

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-renda-bruta-liquida-guess",
    userInput: budgetLesson("pt-renda-bruta-liquida-beginner"),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for total beginners
      ${UNANSWERABLE_GUESS}
      - The plan's guess answers itself: a salary due on the 20th and a payment due on the 5th, asking how much she can count on by the 10th. Writing it as planned fails; the written guess asks about the same idea (when money arrives decides what she can count on) in a way its own dates don't settle

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-fontes-datas-renda-guess",
    userInput: budgetLesson("pt-fontes-datas-renda-beginner"),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for total beginners
      ${UNANSWERABLE_GUESS}
      - The plan's guess gives itself away by its words: it asks which purchase he might not find in the statement "yet", and only the right option says "ainda não" while both others say "já debitado". The written options are worded alike, so the question's words don't point to the right one
      - Every option, the application's included, reads as a natural answer in plain words. The plan's application asks what is still missing and how to treat two records; options written as fragments joined by semicolons, like an answer key ("Outro extrato; transferência interna; fatura sem duplicar"), fail

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-registros-financeiros-guess-options",
    userInput: budgetLesson("pt-registros-financeiros-beginner"),
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, for total beginners
      - Every amount of money on every screen, tables, options, reasons and the activity included, is written one way, one of the two forms MONEY shows: R$ with its thousands separator (R$ 2.400, never R$ 2400) and cents on every amount or on none. A regression to avoid: an earlier draft of this lesson mixed "R$ 3.000,00", "R$ 2400" and "R$ 2.200"
      - Every number in the tables, the formula to explore and the checks matches the plan and adds up

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-renda-bruta-liquida-money-format",
    userInput: budgetLesson("pt-renda-bruta-liquida-beginner"),
  },
];
