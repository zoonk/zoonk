import { type TestCase } from "@/lib/types";
import { type LearnRequestClassification } from "@zoonk/ai/tasks/courses/learn-classification";
import { type CourseLearnClassificationExpected } from "./scorer";

type ExpectedClassification = LearnRequestClassification | readonly LearnRequestClassification[];

type CourseLearnClassificationTestCase = TestCase<CourseLearnClassificationExpected>;

const SCORE_TIERS = `
  - Deterministic scoring: use the same score for majorErrors, minorErrors, and potentialImprovements.
  - Score 10 when the generated classification exactly matches one accepted classification.
  - Score 6 for any other output, including question requests classified as courses, personalized requests classified as reusable courses, reusable courses classified as personalized, missing classification fields, or extra fields.
`;

/**
 * Narrows accepted classifications when a case intentionally allows more than
 * one product-valid answer for an ambiguous prompt.
 */
function isClassificationList(
  classification: ExpectedClassification,
): classification is readonly LearnRequestClassification[] {
  return Array.isArray(classification);
}

/**
 * Converts a single expected classification into the same list shape used by
 * ambiguous cases so deterministic scoring can always compare against one
 * accepted product-shape list.
 */
function getAcceptedClassifications(
  classification: ExpectedClassification,
): readonly LearnRequestClassification[] {
  const classifications = isClassificationList(classification) ? classification : [classification];

  return [...new Set(classifications)];
}

/**
 * Formats accepted classifications for human-readable expectations without
 * changing the structured values used by deterministic scoring.
 */
function getAcceptedClassificationLabel(
  classifications: readonly LearnRequestClassification[],
): string {
  return classifications.map((classification) => `\`${classification}\``).join(" or ");
}

/**
 * Builds one compact rubric for learn-classification evals so every case uses
 * the same score tiers while still documenting the accepted product shape.
 */
function getExpectations({
  extra,
  classifications,
}: {
  extra?: string;
  classifications: readonly LearnRequestClassification[];
}): string {
  const acceptedClassifications = getAcceptedClassificationLabel(classifications);

  return `
    - The output classification should be ${acceptedClassifications}.
    - Return only the structured classification value; do not invent extra labels.
    ${extra ?? ""}
    ${SCORE_TIERS}
  `;
}

/**
 * Keeps the classification matrix independent from routing while preserving
 * the same relevant learner prompts. Only prompts that should stay inside the
 * learn flow are copied here.
 */
function classificationCase({
  classification,
  extra,
  id,
  language = "en",
  prompt,
}: {
  classification: ExpectedClassification;
  extra?: string;
  id: string;
  language?: string;
  prompt: string;
}): CourseLearnClassificationTestCase {
  const classifications = getAcceptedClassifications(classification);

  return {
    expectations: getExpectations({ classifications, extra }),
    expected: { classifications },
    id,
    userInput: { language, prompt },
  };
}

export const TEST_CASES: CourseLearnClassificationTestCase[] = [
  classificationCase({
    classification: "personalized",
    id: "personalized-agentic-engineering-claude-code",
    prompt: "agentic engineering using claude code",
  }),
  classificationCase({
    classification: "course",
    id: "course-observer-method-disconnect-thoughts",
    prompt: "the observer method to disconnect from thoughts",
  }),
  classificationCase({
    classification: "question",
    id: "question-small-weights-ergonomics",
    prompt: "the ergonomically correct way to workout with small weights",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-chemistry-10th-grade",
    prompt: "chemistry for 10th grade students",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-neo-riemannian-guitar-exercises",
    prompt:
      "i want to learn how to apply the neo riemannian theory on guitar through a set of exercises",
  }),
  classificationCase({
    classification: "course",
    id: "course-presentations-humour",
    prompt: "presentations and humour",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-stripe-connect-saas",
    prompt:
      "i want to learn how to implement implement stripe connect and build a saas platform with stripe's apis and start making money",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-good-life",
    prompt: "how to live the good life",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-ekonomi-kelas-10",
    prompt: "ekonomi kelas 10 kurikulum merdeka",
  }),
  classificationCase({
    classification: "course",
    id: "course-beginner-astronomy",
    prompt: "beginner astronomy course",
  }),
  classificationCase({
    classification: "course",
    id: "course-javascript-basics-to-mastery",
    prompt: "javascript from basics to mastery",
  }),
  classificationCase({
    classification: "course",
    id: "course-calculation-strategies",
    prompt: "calculation strategies",
  }),
  classificationCase({
    classification: "course",
    id: "course-policy-distillation",
    prompt: "explain on policy distillation",
  }),
  classificationCase({
    classification: "course",
    id: "course-lithium-ion-battery",
    prompt: "lithium ion battery",
  }),
  classificationCase({
    classification: "course",
    id: "course-photosynthesis",
    prompt: "photosynthesis",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-marketing-mix-model-pymc",
    prompt: "mmm, mix model marketing and pymc marketing",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-technology-business-plan",
    prompt: "technology business plan",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-cac-score-2026-dyslipidemia",
    prompt: "cac score and 2026 acc dyslipidemia guidelines",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-greek-myths-six-year-old",
    prompt: "a greek myths course for smart 6 years old child. make it fun and interactive",
  }),
  classificationCase({
    classification: "course",
    id: "course-java-thread-pools",
    prompt: "java thread pools",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-investing-chatgpt-claude",
    prompt: "investing with the help of chatgpt and claude",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-indie-hacker-marketing",
    prompt: "how do marketing being a indie hacker, i create softwares, but how sell it?",
  }),
  classificationCase({
    classification: "course",
    id: "course-refining-a-model",
    prompt: "refining a model",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-pcos-diagnosis",
    prompt: "diagnostico do sindrome dos ovarios poliquisticos",
  }),
  classificationCase({
    classification: "course",
    id: "course-sindrome-ovarios",
    prompt: "sindrome dos ovarios poliquisticos",
  }),
  classificationCase({
    classification: "question",
    id: "question-roçadeira-engine",
    prompt: "funcionamento motor rocadeira",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-nt-probnp-heart-failure",
    prompt:
      "papsl do nt-probnp na confirmacao e na exclusao do diagnostico de insuficiencia cardiaca cronica, no contexto de ambularorio",
  }),
  classificationCase({
    classification: "course",
    id: "course-insuficiencia-cardiaca-cronica",
    prompt: "insuficiencia cardiaca cronica",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-dynamics-nav-stock",
    prompt:
      "faire de l'analyse de reporpovisionnementde stock par dynamics nav avec nos vente, stock de securtiter etc",
  }),
  classificationCase({
    classification: "course",
    id: "course-army-mdmp",
    prompt: "the army mdmp process",
  }),
  classificationCase({
    classification: "course",
    id: "course-go-concurrent",
    prompt: "go concurrent",
  }),
  classificationCase({
    classification: "course",
    id: "ai-for-kitchen-chefs",
    prompt: "ai for kitchen chefs",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-june-meat-suggestion",
    prompt: "cree moi une suggestion pour le mois de juin a base de viande",
  }),
  classificationCase({
    classification: "course",
    id: "course-sous-vide-cooking",
    prompt: "sous vide cooking",
  }),
  classificationCase({
    classification: "course",
    id: "course-michelin-recipes",
    prompt: "michelin recipes",
  }),
  classificationCase({
    classification: "course",
    id: "course-modern-cuisine-techniques",
    prompt: "modern cuisine techniques",
  }),
  classificationCase({
    classification: "course",
    id: "course-heat-transfer",
    prompt: "heat transfer",
  }),
  classificationCase({
    classification: "course",
    id: "course-pathological-real-functions",
    prompt: "pathological real functions",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-b2c-education-app-audience",
    prompt: "como conseguir audiencia/assinantes para um app b2c de educacao tipo duolingo",
  }),
  classificationCase({
    classification: "course",
    id: "course-coding-levels",
    prompt: "coding, intermidiate/beginner",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-sql-freelance-stack",
    prompt:
      "sql do 0 ao mestre de dados, incluindo pandas, sqlalchemy, soup, e tudo necessario para comecar freelance",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-math-and-logic",
    prompt: "math and logic",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-gpu-programming-no-library",
    prompt: "gpu programming without a library (no vulkan, no opengl, etc)",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-physical-chemistry-grade-11-12",
    prompt: "physical chemistry for grade 11 and 12",
  }),
  classificationCase({
    classification: "question",
    id: "question-how-people-born",
    prompt: "how people born",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-duolingo-like-language-app",
    prompt:
      "quero construir um app igual duolingo para aprender linguas como: frances, ingles, kindumbu e umbundo",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-sixth-grader-math-intuition",
    prompt: "teach math to a 6ty grader. build intuition deep correlation of concepts",
  }),
  classificationCase({
    classification: "course",
    id: "course-warsaw-1600s",
    prompt: "warsaw in 1600s",
  }),
  classificationCase({
    classification: "course",
    id: "course-black-holes-pt",
    prompt: "quero aprender sobre buracos negros",
  }),
  classificationCase({
    classification: "course",
    id: "course-derecho-penal",
    prompt: "derecho penal",
  }),
  classificationCase({ classification: "course", id: "course-dragon-ball", prompt: "dragon ball" }),
  classificationCase({
    classification: "course",
    id: "course-biology",
    prompt: "i want to learn biology",
  }),
  classificationCase({
    classification: "question",
    id: "question-how-computers-work",
    prompt: "how computers work",
  }),
  classificationCase({
    classification: "course",
    id: "course-tabela-periodica",
    prompt: "tabela periodica",
  }),
  classificationCase({ classification: "course", id: "course-ai", prompt: "ai" }),
  classificationCase({
    classification: "course",
    id: "course-engenharia-f1",
    prompt: "engenharia f1",
  }),
  classificationCase({
    classification: "course",
    id: "course-historia-do-brasil",
    prompt: "historia do brasil",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-iphone-16e",
    prompt: "iphone 16e",
  }),
  classificationCase({ classification: "course", id: "course-vendas", prompt: "vendas" }),
  classificationCase({ classification: "course", id: "course-afo", prompt: "afo" }),
  classificationCase({ classification: "course", id: "course-excel", prompt: "excel" }),
  classificationCase({ classification: "course", id: "course-photoshop", prompt: "photoshop" }),
  classificationCase({
    classification: "course",
    id: "course-time-management",
    prompt: "time management",
  }),
  classificationCase({ classification: "course", id: "course-philosophy", prompt: "philosophy" }),
  classificationCase({ classification: "course", id: "course-ethics", prompt: "ethics" }),
  classificationCase({
    classification: "course",
    id: "course-ethics-personal-motivation",
    prompt: "i want to learn ethics so i can make better decisions",
  }),
  classificationCase({ classification: "course", id: "course-psychology", prompt: "psychology" }),
  classificationCase({
    classification: "course",
    id: "course-productivity",
    prompt: "productivity",
  }),
  classificationCase({
    classification: "course",
    id: "course-science-of-happiness",
    prompt: "the science of happiness",
  }),
  classificationCase({
    classification: "course",
    id: "course-higgs-mechanism",
    prompt: "higgs mechanism",
  }),
  classificationCase({ classification: "course", id: "course-investing", prompt: "investing" }),
  classificationCase({
    classification: "course",
    id: "course-trigonometria",
    prompt: "trigonometria",
  }),
  classificationCase({
    classification: "course",
    id: "course-aprender-a-aprender",
    prompt: "aprender a aprender",
  }),
  classificationCase({
    classification: "course",
    id: "course-futurismo-e-foresight",
    prompt: "futurismo e foresight",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-chord-changes-moving-voices",
    prompt: "hear chord changes as moving voices",
  }),
  classificationCase({
    classification: "personalized",
    id: "personalized-smart-as-einstein",
    prompt: "i want to be as smart as einstein",
  }),
  classificationCase({
    classification: "course",
    id: "course-science-of-decision-making",
    prompt: "science of decision making",
  }),
  classificationCase({
    classification: "course",
    id: "course-python-for-data-science",
    prompt: "python for data science",
  }),
  classificationCase({
    classification: "course",
    id: "course-grant-writing-for-nonprofits",
    prompt: "grant writing for nonprofits",
  }),
];
