import { type Goal } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type SpeakingMockExam } from "../language/conversations/conversation-contract";

/** Both exams with a speaking mock are English exams. */
export const SPEAKING_MOCK_LANGUAGE = "en";

/**
 * Language certificates learners name when they say why they're learning ("vou fazer o IELTS").
 * A language goal for one of them becomes an exam goal with the same language engine: speaking
 * and writing graded by the official criteria, and timed mocks.
 */
const LANGUAGE_EXAMS: readonly { name: string; pattern: RegExp }[] = [
  { name: "IELTS", pattern: /\bielts\b/iu },
  // Other TOEFL tests with their own formats and scales, before "TOEFL", which means the iBT.
  { name: "TOEFL ITP", pattern: /\btoefl[\s-]*itp\b/iu },
  { name: "TOEFL Essentials", pattern: /\btoefl[\s-]*essentials\b/iu },
  { name: "TOEFL Junior", pattern: /\btoefl[\s-]*junior\b/iu },
  { name: "TOEFL Primary", pattern: /\btoefl[\s-]*primary\b/iu },
  { name: "TOEFL", pattern: /\btoefl\b/iu },
  { name: "TOEIC", pattern: /\btoeic\b/iu },
  { name: "Cambridge English", pattern: /\bcambridge\b|\b(?:fce|cae|cpe)\b/iu },
  { name: "Duolingo English Test", pattern: /\bduolingo english test\b/iu },
  { name: "DELE", pattern: /\bdele\b/iu },
  { name: "SIELE", pattern: /\bsiele\b/iu },
  { name: "DELF", pattern: /\bdelf\b/iu },
  { name: "DALF", pattern: /\bdalf\b/iu },
  { name: "TCF", pattern: /\btcf\b/iu },
  { name: "TEF", pattern: /\btef\b/iu },
  { name: "Goethe-Zertifikat", pattern: /\bgoethe\b/iu },
  { name: "TestDaF", pattern: /\btestdaf\b/iu },
  { name: "Celpe-Bras", pattern: /\bcelpe[\s-]?bras\b/iu },
  { name: "CILS", pattern: /\bcils\b/iu },
  { name: "CELI", pattern: /\bceli\b/iu },
  { name: "JLPT", pattern: /\bjlpt\b/iu },
  { name: "HSK", pattern: /\bhsk\b/iu },
  { name: "TOPIK", pattern: /\btopik\b/iu },
];

/** The language certificate a reason names, or null when it names none. */
export function detectLanguageExam(reason: string): string | null {
  return LANGUAGE_EXAMS.find((exam) => exam.pattern.test(reason))?.name ?? null;
}

/** The certificates whose speaking test the live call runs as a mock, by the name detection gives. */
const SPEAKING_MOCK_EXAMS: Readonly<Record<string, SpeakingMockExam>> = {
  IELTS: "ielts",
  TOEFL: "toefl",
};

function readText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * The exam whose speaking test the live call runs as a mock for a goal, graded by that exam's
 * criteria: IELTS, or TOEFL iBT (not ITP, Essentials, Junior or Primary, whose formats differ).
 * Read from what the learner said about the goal, its title first, so a language goal and the
 * exam goal it moved to get the same mock; the first certificate named decides, so a "TOEFL ITP"
 * goal gets none. Null for other goals and languages.
 */
export function getSpeakingMockExam(
  goal: Pick<Goal, "details" | "prompt" | "targetLanguage" | "title">,
): SpeakingMockExam | null {
  if (goal.targetLanguage !== SPEAKING_MOCK_LANGUAGE) {
    return null;
  }

  const details = isJsonObject(goal.details) ? goal.details : {};

  const name = [goal.title, goal.prompt, readText(details.examName), readText(details.reason)]
    .map((text) => (text ? detectLanguageExam(text) : null))
    .find((found) => found !== null);

  return name ? (SPEAKING_MOCK_EXAMS[name] ?? null) : null;
}
