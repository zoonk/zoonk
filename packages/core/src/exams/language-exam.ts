import { type Goal } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type GoalDraft } from "../goals/goal-contract";
import { type SpeakingMockExam } from "../language/conversations/conversation-contract";

export const SPEAKING_MOCK_LANGUAGE = "en";

const LANGUAGE_EXAMS: readonly { language: string; name: string; pattern: RegExp }[] = [
  { language: "en", name: "IELTS", pattern: /\bielts\b/iu },
  { language: "en", name: "TOEFL ITP", pattern: /\btoefl[\s-]*itp\b/iu },
  { language: "en", name: "TOEFL Essentials", pattern: /\btoefl[\s-]*essentials\b/iu },
  { language: "en", name: "TOEFL Junior", pattern: /\btoefl[\s-]*junior\b/iu },
  { language: "en", name: "TOEFL Primary", pattern: /\btoefl[\s-]*primary\b/iu },
  { language: "en", name: "TOEFL", pattern: /\btoefl\b/iu },
  { language: "en", name: "TOEIC", pattern: /\btoeic\b/iu },
  {
    language: "en",
    name: "Cambridge English",
    pattern:
      /\bcambridge\b|\b(?:fce|cae|cpe)\b|\b(?:a2 key|b1 preliminary|b2 first|c1 advanced|c2 proficiency)\b/iu,
  },
  { language: "en", name: "Duolingo English Test", pattern: /\bduolingo english test\b/iu },
  // "dele" is also a common Portuguese word ("his") and a Spanish one, so lowercase needs a level.
  { language: "es", name: "DELE", pattern: /\bDELE\b|\b[Dd]ele[\s-]*[ABCabc][12]\b/u },
  { language: "es", name: "SIELE", pattern: /\bsiele\b/iu },
  { language: "fr", name: "DELF", pattern: /\bdelf\b/iu },
  { language: "fr", name: "DALF", pattern: /\bdalf\b/iu },
  { language: "fr", name: "TCF", pattern: /\btcf\b/iu },
  { language: "fr", name: "TEF", pattern: /\btef\b/iu },
  { language: "de", name: "Goethe-Zertifikat", pattern: /\bgoethe\b/iu },
  { language: "de", name: "TestDaF", pattern: /\btestdaf\b/iu },
  { language: "pt", name: "Celpe-Bras", pattern: /\bcelpe[\s-]?bras\b/iu },
  { language: "it", name: "CILS", pattern: /\bcils\b/iu },
  { language: "it", name: "CELI", pattern: /\bceli\b/iu },
  { language: "ja", name: "JLPT", pattern: /\bjlpt\b/iu },
  { language: "zh", name: "HSK", pattern: /\bhsk\b/iu },
  { language: "ko", name: "TOPIK", pattern: /\btopik\b/iu },
];

function readText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function findLanguageExam(text: string) {
  return LANGUAGE_EXAMS.find((exam) => exam.pattern.test(text)) ?? null;
}

export function detectLanguageExam(reason: string): string | null {
  return findLanguageExam(reason)?.name ?? null;
}

export function getCertificateLanguage(
  goal: Pick<GoalDraft, "details" | "kind" | "title">,
): string | null {
  if (goal.kind !== "exam") {
    return null;
  }

  const details = isJsonObject(goal.details) ? goal.details : {};
  const name = readText(details.examName) ?? goal.title;

  return findLanguageExam(name)?.language ?? null;
}

const SPEAKING_MOCK_EXAMS: Readonly<Record<string, SpeakingMockExam>> = {
  IELTS: "ielts",
  TOEFL: "toefl",
};

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
