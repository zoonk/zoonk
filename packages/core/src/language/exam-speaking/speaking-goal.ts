import {
  SPEAKING_EXAMS,
  SPEAKING_EXAM_LANGUAGES,
  type SpeakingExam,
} from "@zoonk/ai/tasks/v2/language/exam-speaking-exams";
import { type Goal } from "@zoonk/db";
import { CEFR_LEVELS, type CefrLevel, isCefrLevel } from "@zoonk/utils/cefr";
import { isJsonObject } from "@zoonk/utils/json";
import { detectLanguageExam } from "../../exams/language-exam";
import { listSpeakingLevels } from "./speaking-formats";

const EXAMS_BY_NAME: Readonly<Record<string, SpeakingExam>> = {
  "Cambridge English": "cambridge",
  DALF: "delf",
  DELE: "dele",
  DELF: "delf",
  "Goethe-Zertifikat": "goethe",
};

const LEVEL_PATTERN = /\b(?<level>[ABC][12])\b/iu;

const EXAM_LEVEL_PATTERNS: readonly RegExp[] = [
  /\b(?:dele|delf|dalf|goethe(?:[\s-]*zertifikat)?|cambridge(?:\s+english)?)\s*[:-]?\s*(?<level>[ABC][12])\b/iu,
  /\b(?<level>[ABC][12])\s+(?:key|preliminary|first|advanced|proficiency)\b/iu,
];

const NAMED_LEVELS: Readonly<
  Record<SpeakingExam, readonly { level: CefrLevel; pattern: RegExp }[]>
> = {
  cambridge: [
    { level: "A2", pattern: /\b(?:key|ket)\b/iu },
    { level: "B1", pattern: /\b(?:preliminary|pet)\b/iu },
    { level: "B2", pattern: /\b(?:first|fce)\b/iu },
    { level: "C1", pattern: /\b(?:advanced|cae)\b/iu },
    { level: "C2", pattern: /\b(?:proficiency|cpe)\b/iu },
  ],
  dele: [],
  delf: [],
  goethe: [
    { level: "A1", pattern: /start deutsch/iu },
    { level: "C2", pattern: /sprachdiplom/iu },
  ],
};

const DALF_PATTERN = /\bdalf\b/iu;

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function toLevel(match: RegExpExecArray | null | undefined): CefrLevel | null {
  const level = match?.groups?.level?.toUpperCase();
  return isCefrLevel(level) ? level : null;
}

function readExamLevel({ exam, text }: { exam: SpeakingExam; text: string }): CefrLevel | null {
  const written = EXAM_LEVEL_PATTERNS.map((pattern) => toLevel(pattern.exec(text))).find(Boolean);
  return written ?? NAMED_LEVELS[exam].find((named) => named.pattern.test(text))?.level ?? null;
}

function readLevel({ exam, text }: { exam: SpeakingExam; text: string }): CefrLevel | null {
  return readExamLevel({ exam, text }) ?? toLevel(LEVEL_PATTERN.exec(text));
}

function toExamLevel({ exam, level }: { exam: SpeakingExam; level: CefrLevel }): CefrLevel {
  const levels = listSpeakingLevels(exam);

  if (levels.includes(level)) {
    return level;
  }

  const index = CEFR_LEVELS.indexOf(level);
  return levels.find((item) => CEFR_LEVELS.indexOf(item) > index) ?? levels.at(-1) ?? level;
}

function findLanguagePaper(language: string | null): SpeakingExam | undefined {
  return SPEAKING_EXAMS.find((exam) => SPEAKING_EXAM_LANGUAGES[exam] === language);
}

export function getSpeakingExamGoal({
  fallbackLevel,
  goal,
}: {
  fallbackLevel: CefrLevel;
  goal: Pick<Goal, "details" | "kind" | "prompt" | "targetLanguage" | "title"> & {
    blueprintName?: string;
  };
}): { exam: SpeakingExam; level: CefrLevel } | null {
  const details = isJsonObject(goal.details) ? goal.details : {};

  const texts = [
    goal.title,
    goal.blueprintName,
    goal.prompt,
    readText(details.examName),
    readText(details.reason),
  ].filter((text): text is string => Boolean(text));

  const name = texts.map((text) => detectLanguageExam(text)).find((found) => found !== null);
  const unnamed = !name && goal.kind === "language";
  const exam = unnamed ? findLanguagePaper(goal.targetLanguage) : name && EXAMS_BY_NAME[name];

  if (!exam || goal.targetLanguage !== SPEAKING_EXAM_LANGUAGES[exam]) {
    return null;
  }

  const target = [details.targetScore, details.targetLevel]
    .map((value) => readText(value))
    .filter((text): text is string => text !== null);

  const findLevel = (from: readonly string[], read: typeof readLevel) =>
    from.map((text) => read({ exam, text })).find((found) => found !== null);

  if (unnamed) {
    const level = findLevel(target, readLevel) ?? fallbackLevel;
    return { exam, level: toExamLevel({ exam, level }) };
  }

  const named =
    findLevel(texts, readExamLevel) ??
    (texts.some((text) => DALF_PATTERN.test(text)) ? "C1" : null);

  const targeted = findLevel(target, readLevel);
  const preferred = goal.kind === "language" ? (targeted ?? named) : (named ?? targeted);
  const level = preferred ?? findLevel(texts, readLevel) ?? fallbackLevel;

  return { exam, level: toExamLevel({ exam, level }) };
}
