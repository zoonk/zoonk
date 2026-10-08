import { type TestCase } from "@/lib/types";
import { type CourseDetailsParams } from "@zoonk/ai/tasks/v2/courses/details";
import { type CourseDetailsExpected } from "./scorer";

const SHARED_EXPECTATIONS = `
  - The output is a course page: description (1 to 3 sentences), landingPage (valueProposition, 3 to 5 audience items and 4 to 6 outcomes) and 1 or 2 categories; code checks score sizes and category validity, so don't judge them
  - CHAPTERS are only the first band written so far: the copy describes the whole course, not only those chapters
  - The page is shared by every learner of the course, so nothing is tailored to one person
  - Don't evaluate JSON formatting
`;

function chapter(level: string, title: string, description: string) {
  return { description, level, title };
}

export const TEST_CASES: TestCase<CourseDetailsExpected, CourseDetailsParams>[] = [
  {
    expectations: `
      - MUST be in US English
      - Names concrete parts of data analysis: organizing and cleaning data, summaries, charts, drawing conclusions, checking AI's analysis
      - Uses at work (reports, decisions, marketing, operations) and everyday life (personal finances, reading statistics in the news) without promising a job

      ${SHARED_EXPECTATIONS}
    `,
    expected: { categories: ["tech", "business", "math"] },
    id: "en-data-analysis-beginner",
    userInput: {
      chapters: [
        chapter(
          "beginner",
          "Spreadsheets for analysis",
          "Organize raw numbers into tables you can sort, filter and sum.",
        ),
        chapter(
          "beginner",
          "Cleaning messy data",
          "Fix duplicates, blanks and inconsistent formats before trusting a result.",
        ),
        chapter(
          "beginner",
          "Averages and spread",
          "Summarize a column with the right average and see how much values vary.",
        ),
        chapter(
          "beginner",
          "Charts that tell the truth",
          "Pick the chart that fits the question and avoid misleading scales.",
        ),
        chapter(
          "beginner",
          "Checking AI's analysis",
          "Ask an AI assistant for an analysis and verify its numbers and claims.",
        ),
      ],
      courseTitle: "Data analysis",
      language: "en",
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Pop culture: personal, creative, social and cultural uses (discussion, criticism, fan communities, understanding references, storytelling), never careers or jobs
      - Specific to Star Wars (its saga, characters, world-building, influence on film and franchises), not generic film copy

      ${SHARED_EXPECTATIONS}
    `,
    expected: { categories: ["culture", "arts"] },
    id: "en-star-wars-overview",
    userInput: {
      chapters: [
        chapter(
          "overview",
          "A saga in nine episodes",
          "How the Skywalker story unfolds across three trilogies.",
        ),
        chapter(
          "overview",
          "Myth and the hero's journey",
          "The old myths George Lucas borrowed to build his story.",
        ),
        chapter(
          "overview",
          "Building a galaxy",
          "Planets, species and technology that make the world feel lived-in.",
        ),
        chapter(
          "overview",
          "Effects that changed movies",
          "How the films pushed special effects and sound design forward.",
        ),
        chapter(
          "overview",
          "From films to a franchise",
          "Series, games and books that grew the story and its fans.",
        ),
      ],
      courseTitle: "Star Wars",
      language: "en",
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Regulated profession: the course helps someone understand contracts, read them carefully and know when to ask a lawyer; nothing says or implies giving legal advice, representing clients, drafting binding contracts for others or replacing law school or a lawyer
      - Audience examples like freelancers, small business owners, tenants or students preparing for law school fit

      ${SHARED_EXPECTATIONS}
    `,
    expected: { categories: ["law"] },
    id: "en-contract-law-beginner",
    userInput: {
      chapters: [
        chapter(
          "beginner",
          "What makes a contract binding",
          "Offer, acceptance, consideration and when a promise becomes enforceable.",
        ),
        chapter(
          "beginner",
          "Reading the fine print",
          "Common clauses such as termination, liability limits and automatic renewals.",
        ),
        chapter(
          "beginner",
          "When contracts go wrong",
          "Breach, remedies and what courts usually award.",
        ),
        chapter(
          "beginner",
          "Contracts you sign every day",
          "Leases, job offers, app terms and freelance agreements.",
        ),
      ],
      courseTitle: "Contract law",
      language: "en",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese, including audience nouns and roles
      - Regulated field: frames the course as understanding and study of how medicines act, never as qualifying anyone to prescribe, diagnose, treat or choose doses for patients; nursing or pharmacy students, caregivers and curious people fit
      - Everyday use such as reading a package insert (bula) or talking with a doctor is welcome

      ${SHARED_EXPECTATIONS}
    `,
    expected: { categories: ["health", "science"] },
    id: "pt-farmacologia-beginner",
    userInput: {
      chapters: [
        chapter(
          "beginner",
          "Como os remédios agem no corpo",
          "Receptores, enzimas e o caminho de um remédio da absorção à eliminação.",
        ),
        chapter(
          "beginner",
          "Doses e vias de administração",
          "Por que a mesma substância muda de efeito pela boca, na veia ou na pele.",
        ),
        chapter(
          "beginner",
          "Interações e efeitos adversos",
          "Quando dois remédios, ou um remédio e um alimento, se atrapalham.",
        ),
        chapter(
          "beginner",
          "Antibióticos e resistência",
          "Como os antibióticos funcionam e por que o uso errado cria bactérias resistentes.",
        ),
      ],
      courseTitle: "Farmacologia",
      language: "pt",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Names the big ideas of economics (escassez, preços, juros, inflação, papel do governo, comércio) in plain words; Brazilian examples are welcome
      - Includes everyday uses (orçamento pessoal, entender notícias, decidir sobre crédito) next to work and civic ones, with no promise of a job

      ${SHARED_EXPECTATIONS}
    `,
    expected: { categories: ["economics"] },
    id: "pt-economia-overview",
    userInput: {
      chapters: [
        chapter(
          "overview",
          "Escassez e escolhas",
          "Por que toda escolha tem um custo e como isso explica decisões do dia a dia.",
        ),
        chapter(
          "overview",
          "Preços, oferta e demanda",
          "Como os preços sobem e descem conforme o que se quer e o que existe.",
        ),
        chapter(
          "overview",
          "Dinheiro, bancos e juros",
          "O que os bancos fazem com o seu dinheiro e por que os juros mudam tudo.",
        ),
        chapter(
          "overview",
          "Inflação e poder de compra",
          "Por que o mesmo salário compra menos com o tempo e quem controla isso.",
        ),
        chapter(
          "overview",
          "O papel do governo",
          "Impostos, gastos públicos e dívida, e como afetam o país.",
        ),
      ],
      courseTitle: "Economia",
      language: "pt",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese; the course is English itself, for Brazilian learners
      - Focuses on communicating in real situations (conversas, viagens, estudo, trabalho, cultura), from first conversations to confident use
      - Never promises fluency, a certificate, an exam score or a job, and never mentions how long it takes
      - Categories don't matter for language courses: don't judge them

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-ingles-language-beginner",
    userInput: {
      chapters: [
        chapter("beginner", "Apresentações", "Dizer quem você é, de onde vem e o que faz."),
        chapter(
          "beginner",
          "No aeroporto e no hotel",
          "Fazer check-in, pedir informações e resolver problemas simples.",
        ),
        chapter("beginner", "Pedindo comida", "Ler um cardápio, pedir e pagar em um restaurante."),
        chapter(
          "beginner",
          "Rotina e horários",
          "Falar sobre o seu dia, marcar compromissos e combinar horários.",
        ),
      ],
      courseTitle: "Inglês",
      language: "pt",
      targetLanguage: "en",
    },
  },
];
