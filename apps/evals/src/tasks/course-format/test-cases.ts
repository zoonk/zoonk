import { type TestCase } from "@/lib/types";
import { type CourseFormat, type CourseFormatParams } from "@zoonk/ai/tasks/courses/format";
import { type CourseFormatExpected } from "./scorer";

type ExpectedCourseFormat = CourseFormat | readonly CourseFormat[];

type CourseFormatTestCase = TestCase<CourseFormatExpected, CourseFormatParams>;

const SCORE_TIERS = `
  - Deterministic scoring: use the same score for majorErrors, minorErrors, and potentialImprovements.
  - Score 10 when the generated courseFormat exactly matches one accepted courseFormat.
  - Score 6 for any other output, including core courses classified as coding, coding courses classified as core, language courses classified as core, missing courseFormat fields, or extra fields.
`;

/**
 * Narrows accepted course formats when a case intentionally allows more than one
 * valid answer for an ambiguous shared-learning prompt.
 */
function isCourseFormatList(format: ExpectedCourseFormat): format is readonly CourseFormat[] {
  return Array.isArray(format);
}

/**
 * Converts a single expected format into the same list shape used by ambiguous
 * cases so deterministic scoring can always compare against one accepted list.
 */
function getAcceptedCourseFormats(format: ExpectedCourseFormat): readonly CourseFormat[] {
  const formats = isCourseFormatList(format) ? format : [format];

  return [...new Set(formats)];
}

/**
 * Formats accepted course formats for human-readable expectations without
 * changing the structured values used by deterministic scoring.
 */
function getAcceptedCourseFormatLabel(formats: readonly CourseFormat[]): string {
  return formats.map((format) => `\`${format}\``).join(" or ");
}

/**
 * Builds one compact rubric for course-format evals so every case uses
 * the same score tiers while still documenting the accepted teaching format.
 */
function getExpectations({
  courseFormats,
  extra,
}: {
  courseFormats: readonly CourseFormat[];
  extra?: string;
}): string {
  const acceptedCourseFormats = getAcceptedCourseFormatLabel(courseFormats);

  return `
    - The output courseFormat should be ${acceptedCourseFormats}.
    - Return only the structured courseFormat value; do not invent extra labels.
    ${extra ?? ""}
    ${SCORE_TIERS}
  `;
}

/**
 * Keeps the course-format matrix focused on prompts that intent and
 * personalization should already have accepted as shared learning.
 */
function courseFormatCase({
  courseFormat,
  extra,
  id,
  language = "en",
  prompt,
}: {
  courseFormat: ExpectedCourseFormat;
  extra?: string;
  id: string;
  language?: string;
  prompt: string;
}): CourseFormatTestCase {
  const courseFormats = getAcceptedCourseFormats(courseFormat);

  return {
    expectations: getExpectations({ courseFormats, extra }),
    expected: { courseFormats },
    id,
    userInput: { language, prompt },
  };
}

export const TEST_CASES: CourseFormatTestCase[] = [
  courseFormatCase({
    courseFormat: "language",
    id: "arabic-using-bangla",
    prompt: "arabic using bangla",
  }),
  courseFormatCase({ courseFormat: "language", id: "tamazight", prompt: "tamazight" }),
  courseFormatCase({
    courseFormat: "instrument",
    id: "beginner-guitar",
    prompt: "beginner guitar",
  }),
  courseFormatCase({ courseFormat: "instrument", id: "piano", prompt: "piano" }),
  courseFormatCase({ courseFormat: "practical", id: "scrunchie", prompt: "scrunchie" }),
  courseFormatCase({ courseFormat: "practical", id: "artesanato", prompt: "artesanato" }),
  courseFormatCase({ courseFormat: "core", id: "music-theory", prompt: "music theory" }),
  courseFormatCase({ courseFormat: "core", id: "history-of-music", prompt: "history of music" }),
  courseFormatCase({
    courseFormat: "practical",
    extra:
      "- GitHub Actions is developer workflow automation, not a programming language or framework course.",
    id: "github-actions",
    prompt: "github actions",
  }),
  courseFormatCase({
    courseFormat: "core",
    id: "beginner-astronomy",
    prompt: "beginner astronomy course",
  }),
  courseFormatCase({
    courseFormat: "coding",
    id: "javascript-basics-to-mastery",
    prompt: "javascript from basics to mastery",
  }),
  courseFormatCase({
    courseFormat: "core",
    id: "calculation-strategies",
    prompt: "calculation strategies",
  }),
  courseFormatCase({
    courseFormat: "core",
    id: "lithium-ion-battery",
    prompt: "lithium ion battery",
  }),
  courseFormatCase({ courseFormat: "core", id: "photosynthesis", prompt: "photosynthesis" }),
  courseFormatCase({
    courseFormat: "coding",
    id: "java-thread-pools",
    prompt: "java thread pools",
  }),
  courseFormatCase({
    courseFormat: "core",
    id: "sindrome-ovarios",
    prompt: "sindrome dos ovarios poliquisticos",
  }),
  courseFormatCase({
    courseFormat: "core",
    id: "insuficiencia-cardiaca-cronica",
    prompt: "insuficiencia cardiaca cronica",
  }),
  courseFormatCase({ courseFormat: "core", id: "army-mdmp", prompt: "the army mdmp process" }),
  courseFormatCase({ courseFormat: "coding", id: "go-concurrent", prompt: "go concurrent" }),
  courseFormatCase({
    courseFormat: "practical",
    id: "sous-vide-cooking",
    prompt: "sous vide cooking",
  }),
  courseFormatCase({
    courseFormat: "practical",
    id: "michelin-recipes",
    prompt: "michelin recipes",
  }),
  courseFormatCase({
    courseFormat: "practical",
    id: "modern-cuisine-techniques",
    prompt: "modern cuisine techniques",
  }),
  courseFormatCase({ courseFormat: "core", id: "heat-transfer", prompt: "heat transfer" }),
  courseFormatCase({
    courseFormat: "core",
    id: "pathological-real-functions",
    prompt: "pathological real functions",
  }),
  courseFormatCase({
    courseFormat: "coding",
    id: "coding-levels",
    prompt: "coding, intermidiate/beginner",
  }),
  courseFormatCase({ courseFormat: "core", id: "warsaw-1600s", prompt: "warsaw in 1600s" }),
  courseFormatCase({
    courseFormat: "core",
    id: "black-holes-pt",
    prompt: "quero aprender sobre buracos negros",
  }),
  courseFormatCase({ courseFormat: "core", id: "derecho-penal", prompt: "derecho penal" }),
  courseFormatCase({ courseFormat: "core", id: "dragon-ball", prompt: "dragon ball" }),
  courseFormatCase({ courseFormat: "core", id: "biology", prompt: "i want to learn biology" }),
  courseFormatCase({ courseFormat: "core", id: "tabela-periodica", prompt: "tabela periodica" }),
  courseFormatCase({ courseFormat: "core", id: "ai", prompt: "ai" }),
  courseFormatCase({ courseFormat: "core", id: "engenharia-f1", prompt: "engenharia f1" }),
  courseFormatCase({
    courseFormat: "core",
    extra:
      "- F1 is a popular aspirational domain, and engineering is a shared course identity here.",
    id: "f1-engineering",
    prompt: "F1 Engineering",
  }),
  courseFormatCase({
    courseFormat: "core",
    id: "historia-do-brasil",
    prompt: "historia do brasil",
  }),
  courseFormatCase({ courseFormat: "practical", id: "iphone-16e", prompt: "iphone 16e" }),
  courseFormatCase({ courseFormat: "core", id: "vendas", prompt: "vendas" }),
  courseFormatCase({ courseFormat: "practical", id: "excel", prompt: "excel" }),
  courseFormatCase({ courseFormat: "practical", id: "photoshop", prompt: "photoshop" }),
  courseFormatCase({ courseFormat: "core", id: "time-management", prompt: "time management" }),
  courseFormatCase({ courseFormat: "core", id: "philosophy", prompt: "philosophy" }),
  courseFormatCase({ courseFormat: "core", id: "ethics", prompt: "ethics" }),
  courseFormatCase({
    courseFormat: "core",
    id: "ethics-personal-motivation",
    prompt: "i want to learn ethics so i can make better decisions",
  }),
  courseFormatCase({ courseFormat: "core", id: "psychology", prompt: "psychology" }),
  courseFormatCase({ courseFormat: "core", id: "productivity", prompt: "productivity" }),
  courseFormatCase({
    courseFormat: "core",
    id: "science-of-happiness",
    prompt: "the science of happiness",
  }),
  courseFormatCase({ courseFormat: "core", id: "higgs-mechanism", prompt: "higgs mechanism" }),
  courseFormatCase({ courseFormat: "core", id: "investing", prompt: "investing" }),
  courseFormatCase({ courseFormat: "core", id: "trigonometria", prompt: "trigonometria" }),
  courseFormatCase({
    courseFormat: "core",
    id: "aprender-a-aprender",
    prompt: "aprender a aprender",
  }),
  courseFormatCase({
    courseFormat: "core",
    id: "futurismo-e-foresight",
    prompt: "futurismo e foresight",
  }),
  courseFormatCase({
    courseFormat: "core",
    id: "science-of-decision-making",
    prompt: "science of decision making",
  }),
  courseFormatCase({ courseFormat: "core", id: "semiotics", prompt: "semiotics" }),
  courseFormatCase({ courseFormat: "core", id: "fotografie", prompt: "Fotografie" }),
  courseFormatCase({
    courseFormat: "core",
    id: "differential-geometry",
    prompt: "Differential Geometry",
  }),
  courseFormatCase({
    courseFormat: "core",
    id: "grand-unified-field-theory",
    prompt: "Grand Unified Field Theory",
  }),
  courseFormatCase({
    courseFormat: "core",
    extra:
      "- Offensive security is a conceptual cybersecurity domain here, not a programming language, framework, or short workflow tutorial.",
    id: "offense-security",
    prompt: "Offense security",
  }),
  courseFormatCase({
    courseFormat: "core",
    id: "math-of-black-holes",
    prompt: "Math of Black holes",
  }),
  courseFormatCase({ courseFormat: "coding", id: "python", prompt: "Python" }),
  courseFormatCase({ courseFormat: "practical", id: "morse-code", prompt: "Morse code" }),
  courseFormatCase({ courseFormat: "practical", id: "arch-linux", prompt: "arch linux" }),
  courseFormatCase({ courseFormat: "practical", id: "github", prompt: "github" }),
  courseFormatCase({
    courseFormat: "core",
    id: "mechanical-engineering",
    prompt: "Mechanical Engineering",
  }),
  courseFormatCase({ courseFormat: "core", id: "communication", prompt: "communication" }),
  courseFormatCase({
    courseFormat: "core",
    extra:
      "- Compilers is a computer-science domain with theory-heavy chapters unless the prompt asks to implement one in a specific language.",
    id: "compilers",
    prompt: "compilers",
  }),
  courseFormatCase({ courseFormat: "core", id: "math", prompt: "math" }),
  courseFormatCase({ courseFormat: "practical", id: "vibecoding", prompt: "vibecoding" }),
  courseFormatCase({ courseFormat: "coding", id: "golang", prompt: "golang" }),
  courseFormatCase({
    courseFormat: "language",
    id: "english-from-russian",
    prompt: "english from russian",
  }),
  courseFormatCase({
    courseFormat: "core",
    id: "lineare-funktionen",
    prompt: "Lineare Funktionen",
  }),
  courseFormatCase({
    courseFormat: "core",
    id: "proportionalitaeten",
    prompt: "Proportionalitäten",
  }),
  courseFormatCase({
    courseFormat: "coding",
    id: "college-sql-introduction",
    prompt: "I need a college level SQL introduction course",
  }),
  courseFormatCase({ courseFormat: "core", id: "world-history", prompt: "world history" }),
  courseFormatCase({ courseFormat: "core", id: "calculus", prompt: "calculus" }),
  courseFormatCase({ courseFormat: "core", id: "psicologia", prompt: "psicologia" }),
  courseFormatCase({ courseFormat: "core", id: "physics", prompt: "physics" }),
  courseFormatCase({ courseFormat: "core", id: "contabilidade", prompt: "contabilidade" }),
  courseFormatCase({ courseFormat: "coding", id: "coding", prompt: "coding" }),
  courseFormatCase({
    courseFormat: "language",
    id: "european-portuguese",
    prompt: "european portuguese",
  }),
  courseFormatCase({ courseFormat: "core", id: "soft-skills", prompt: "soft skills" }),
  courseFormatCase({ courseFormat: "core", id: "maths", prompt: "maths" }),
  courseFormatCase({ courseFormat: "core", id: "black-hole", prompt: "black hole" }),
  courseFormatCase({ courseFormat: "core", id: "qatif", prompt: "qatif" }),
  courseFormatCase({ courseFormat: "core", id: "saudi-arabia", prompt: "saudi arabia" }),
  courseFormatCase({ courseFormat: "core", id: "linear-algebra", prompt: "linear algebra" }),
  courseFormatCase({ courseFormat: "core", id: "deep-sea-creature", prompt: "deep sea creature" }),
  courseFormatCase({
    courseFormat: "core",
    id: "artificial-intelligence",
    prompt: "Artificial intelligence",
  }),
  courseFormatCase({ courseFormat: "core", id: "probability", prompt: "Probability" }),
  courseFormatCase({ courseFormat: "core", id: "computer-science", prompt: "computer science" }),
  courseFormatCase({ courseFormat: "core", id: "graphic-design", prompt: "graphic design" }),
  courseFormatCase({ courseFormat: "core", id: "economics", prompt: "economics" }),
  courseFormatCase({ courseFormat: "core", id: "history", prompt: "history" }),
  courseFormatCase({ courseFormat: "core", id: "curso-de-fisica", prompt: "curso de fisica" }),
  courseFormatCase({ courseFormat: "core", id: "curso-de-biologia", prompt: "curso de biologia" }),
  courseFormatCase({ courseFormat: "core", id: "creative-writing", prompt: "creative writing" }),
  courseFormatCase({ courseFormat: "core", id: "zh-psychology", prompt: "心理学" }),
];
