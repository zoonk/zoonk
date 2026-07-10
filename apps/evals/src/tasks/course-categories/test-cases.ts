import { type TestCase } from "@/lib/types";
import { type CourseCategoriesParams } from "@zoonk/ai/tasks/courses/categories";
import { type AICourseCategory, AI_COURSE_CATEGORIES } from "@zoonk/utils/categories";
import { type CourseCategoriesExpected } from "./scorer";

type CourseCategoriesTestCase = TestCase<CourseCategoriesExpected, CourseCategoriesParams>;
type PrimaryCategoryCase = { courseTitle: string; id: string };

/**
 * Attaches the exact category set used by the deterministic scorer without
 * maintaining a duplicate prose rubric for a judge model.
 */
function courseCategoriesCase({
  categories,
  courseTitle,
  id,
}: CourseCategoriesExpected & { courseTitle: string; id: string }): CourseCategoriesTestCase {
  return { expected: { categories }, id, userInput: { courseTitle } };
}

const PRIMARY_CATEGORY_CASES = {
  arts: { courseTitle: "Watercolor Painting Techniques", id: "en-watercolor-painting" },
  business: {
    courseTitle: "Small Business Operations Management",
    id: "en-small-business-operations",
  },
  communication: { courseTitle: "Public Speaking Fundamentals", id: "en-public-speaking" },
  culture: {
    courseTitle: "Japanese Cultural Traditions and Etiquette",
    id: "en-japanese-cultural-traditions",
  },
  economics: {
    courseTitle: "Microeconomics: Supply, Demand, and Market Equilibrium",
    id: "en-microeconomics",
  },
  engineering: {
    courseTitle: "Engenharia Estrutural: Projeto de Vigas de Concreto Armado",
    id: "pt-structural-engineering",
  },
  geography: {
    courseTitle: "Geografía Mundial: Países, Capitales y Regiones Físicas",
    id: "es-world-geography",
  },
  health: { courseTitle: "First Aid and CPR", id: "en-first-aid-cpr" },
  history: { courseTitle: "Historia de Roma", id: "es-historia-de-roma" },
  law: {
    courseTitle: "Direito Contratual: Formação, Inadimplemento e Remédios",
    id: "pt-contract-law",
  },
  math: { courseTitle: "Calculus", id: "en-calculus" },
  science: {
    courseTitle: "Organic Chemistry: Reactions and Molecular Structure",
    id: "en-organic-chemistry",
  },
  society: { courseTitle: "Sociology: Social Institutions and Inequality", id: "en-sociology" },
  tech: { courseTitle: "Linux System Administration", id: "en-linux-system-administration" },
} satisfies Record<AICourseCategory, PrimaryCategoryCase>;

/**
 * Converts every AI-assignable category into a required single-label anchor.
 * The exhaustive record makes taxonomy additions fail type-checking until a
 * corresponding eval case is supplied.
 */
function getPrimaryCategoryTestCase(category: AICourseCategory): CourseCategoriesTestCase {
  const definition = PRIMARY_CATEGORY_CASES[category];

  return courseCategoriesCase({ categories: [category], ...definition });
}

const EDGE_CASES: CourseCategoriesTestCase[] = [
  courseCategoriesCase({
    categories: ["business", "communication"],
    courseTitle: "Business Communication: Writing Proposals and Presenting to Clients",
    id: "en-business-communication",
  }),
  courseCategoriesCase({
    categories: ["economics", "engineering"],
    courseTitle: "Engineering Economics: Cost Analysis for Infrastructure Projects",
    id: "en-engineering-economics",
  }),
  courseCategoriesCase({
    categories: ["arts", "science"],
    courseTitle: "Art Conservation Science: Pigment Chemistry and Painting Restoration",
    id: "en-art-conservation-science",
  }),
  courseCategoriesCase({
    categories: ["health", "math"],
    courseTitle: "Statistics for Public Health: Rates, Risk Ratios, and Confidence Intervals",
    id: "en-public-health-statistics",
  }),
  courseCategoriesCase({
    categories: ["geography", "tech"],
    courseTitle: "Geographic Information Systems: Spatial Analysis with QGIS",
    id: "en-geographic-information-systems",
  }),
  courseCategoriesCase({
    categories: ["law", "tech"],
    courseTitle: "Cybersecurity Law: Technical Controls and Legal Compliance",
    id: "en-cybersecurity-law",
  }),
  courseCategoriesCase({
    categories: ["arts", "history"],
    courseTitle: "History of Painting: Renaissance to Impressionism",
    id: "en-history-of-painting",
  }),
  courseCategoriesCase({
    categories: ["culture", "geography", "society"],
    courseTitle: "Cultural Geography: Migration, Place, and Social Identity",
    id: "en-cultural-geography",
  }),
  courseCategoriesCase({
    categories: ["math"],
    courseTitle: "The Law of Sines and Cosines",
    id: "en-law-of-sines",
  }),
  courseCategoriesCase({
    categories: ["economics"],
    courseTitle: "Business Cycles: Recessions, Inflation, and Monetary Policy",
    id: "en-business-cycles",
  }),
  courseCategoriesCase({
    categories: ["arts"],
    courseTitle: "Science Fiction Illustration: Characters and Alien Worlds",
    id: "en-science-fiction-illustration",
  }),
  courseCategoriesCase({
    categories: ["tech"],
    courseTitle: "The Art of Debugging Software",
    id: "en-art-of-debugging",
  }),
];

export const TEST_CASES: CourseCategoriesTestCase[] = [
  ...AI_COURSE_CATEGORIES.map((category) => getPrimaryCategoryTestCase(category)),
  ...EDGE_CASES,
];
