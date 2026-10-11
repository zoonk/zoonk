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

/** The exams by the name `detectLanguageExam` gives; DALF is DELF's upper levels. */
const EXAMS_BY_NAME: Readonly<Record<string, SpeakingExam>> = {
  "Cambridge English": "cambridge",
  DALF: "delf",
  DELE: "dele",
  DELF: "delf",
  "Goethe-Zertifikat": "goethe",
};

const LEVEL_PATTERN = /\b(?<level>[ABC][12])\b/iu;

/** A level written with the exam's name ("DELE B2", "Goethe-Zertifikat B1", "B2 First"). */
const EXAM_LEVEL_PATTERNS: readonly RegExp[] = [
  /\b(?:dele|delf|dalf|goethe(?:[\s-]*zertifikat)?|cambridge(?:\s+english)?)\s*[:-]?\s*(?<level>[ABC][12])\b/iu,
  /\b(?<level>[ABC][12])\s+(?:key|preliminary|first|advanced|proficiency)\b/iu,
];

/** Exams whose name gives their level: Cambridge's, and Goethe's Start Deutsch and Sprachdiplom. */
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

/** DALF without a level is DALF C1, the first of its two. */
const DALF_PATTERN = /\bdalf\b/iu;

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function toLevel(match: RegExpExecArray | null | undefined): CefrLevel | null {
  const level = match?.groups?.level?.toUpperCase();
  return isCefrLevel(level) ? level : null;
}

/** The level the text gives the exam itself: written with its name, or the exam's own name. */
function readExamLevel({ exam, text }: { exam: SpeakingExam; text: string }): CefrLevel | null {
  const written = EXAM_LEVEL_PATTERNS.map((pattern) => toLevel(pattern.exec(text))).find(Boolean);
  return written ?? NAMED_LEVELS[exam].find((named) => named.pattern.test(text))?.level ?? null;
}

/** Any level the text names; a level on its own may be the learner's, so it comes last. */
function readLevel({ exam, text }: { exam: SpeakingExam; text: string }): CefrLevel | null {
  return readExamLevel({ exam, text }) ?? toLevel(LEVEL_PATTERN.exec(text));
}

/** The nearest level the exam has, so a learner at A1 practices Cambridge's lowest, A2 Key. */
function toExamLevel({ exam, level }: { exam: SpeakingExam; level: CefrLevel }): CefrLevel {
  const levels = listSpeakingLevels(exam);

  if (levels.includes(level)) {
    return level;
  }

  const index = CEFR_LEVELS.indexOf(level);
  return levels.find((item) => CEFR_LEVELS.indexOf(item) > index) ?? levels.at(-1) ?? level;
}

/** The certificate a language's learners practice when their goal names no exam. */
function findLanguagePaper(language: string | null): SpeakingExam | undefined {
  return SPEAKING_EXAMS.find((exam) => SPEAKING_EXAM_LANGUAGES[exam] === language);
}

/**
 * The speaking paper a goal prepares for: the exam named in its title, what the learner said or
 * what onboarding understood (DELE, DELF or DALF, the Goethe-Zertifikat, Cambridge English), in its
 * own language. An exam goal takes the level given with the exam ("DELE B2", "Cambridge
 * Advanced"), else the target onboarding understood; a language goal practices at its own target
 * first ("B1+" is B1 Preliminary even when it names B2 First), since that's the level it works
 * toward. Then a level the texts name on their own (which may be the learner's own), else
 * `fallbackLevel` (the learner's speaking level). A language goal that names no exam practices
 * its language's certificate in exam style, at its target or else the learner's speaking level.
 * Null for other goals, and for a language goal naming an exam without a paper here (IELTS).
 */
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

  // Without an exam, a level in the learner's words is where they were ("i think i'm A2").
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
