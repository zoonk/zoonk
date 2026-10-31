import { type Goal } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { toNameWords } from "@zoonk/utils/name-words";
import { normalizeString } from "@zoonk/utils/string";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getAnsweredQuestions } from "../../view-models/onboarding/onboarding-steps";
import { type ExamChoice, findChoiceOption, listChoiceGroups } from "./exam-choices";

type Subject = ExamStructure["subjects"][number];

type Option = Pick<Subject, "name" | "shortName">;

type NamingGoal = Pick<Goal, "details" | "language" | "prompt" | "title">;

/** Shorter words are acronyms like "TI", which a notice can spell out in its other options' names. */
const MIN_NAMING_WORD = 4;

const DOUBT_WORDS = new Set([
  "außer",
  "ausser",
  "duvida",
  "except",
  "excepto",
  "exceto",
  "indecisa",
  "indeciso",
  "jamais",
  "jamas",
  "kein",
  "keine",
  "keinem",
  "keinen",
  "keiner",
  "maybe",
  "nao",
  "neither",
  "nem",
  "never",
  "ni",
  "nicht",
  "nie",
  "niemals",
  "non",
  "nor",
  "not",
  "nunca",
  "ohne",
  "pas",
  "perhaps",
  "quiza",
  "quizas",
  "salvo",
  "sans",
  "sauf",
  "sem",
  "sin",
  "talvez",
  "undecided",
  "unsure",
  "vielleicht",
  "weder",
  "without",
]);

const DOUBT_PHRASES = [/n['’]t\b/u, /\bpeut[- ]etre\b/u, /\btal vez\b/u];

/** "no" refuses in English and Spanish, but in Portuguese it's "in the": "passar no concurso". */
function isDoubtWord({ language, word }: { language: string; word: string }): boolean {
  return DOUBT_WORDS.has(word) || (word === "no" && language !== "pt");
}

/** "não quero Auditoria" or "talvez Auditoria" doesn't say the learner takes Auditoria. */
function isDoubtful({ language, text }: { language: string; text: string }): boolean {
  const normalized = normalizeString(text);

  return (
    toNameWords(text).some((word) => isDoubtWord({ language, word })) ||
    DOUBT_PHRASES.some((phrase) => phrase.test(normalized))
  );
}

function toOptionWords(option: Option): Set<string> {
  return new Set(
    [option.name, option.shortName ?? ""]
      .flatMap((name) => toNameWords(name))
      .filter((word) => word.length >= MIN_NAMING_WORD),
  );
}

/** "Auditoria Governamental" names a subject everyone takes, not the Auditoria specialty. */
function withoutSubjects({ subjects, text }: { subjects: readonly string[]; text: string }) {
  return subjects.reduce(
    (rest, subject) => rest.replaceAll(normalizeString(subject), " "),
    normalizeString(text),
  );
}

/** A word names an option only when no other option has it; refused or doubted options are never picked. */
function findNamedOption({
  language,
  options,
  subjects,
  texts,
}: {
  language: string;
  options: readonly Option[];
  subjects: readonly string[];
  texts: readonly string[];
}): string | null {
  const optionWords = options.map((option) => toOptionWords(option));
  const isOwn = (word: string) => optionWords.filter((words) => words.has(word)).length === 1;

  const mentions = texts.map((text) => {
    const said = new Set(toNameWords(withoutSubjects({ subjects, text })));

    return {
      doubtful: isDoubtful({ language, text }),
      names: options.flatMap((option, index) =>
        [...(optionWords[index] ?? [])].some((word) => said.has(word) && isOwn(word))
          ? [option.name]
          : [],
      ),
    };
  });

  const doubted = new Set(mentions.flatMap((mention) => (mention.doubtful ? mention.names : [])));

  const named = [
    ...new Set(mentions.flatMap((mention) => (mention.doubtful ? [] : mention.names))),
  ].filter((name) => !doubted.has(name));

  return named.length === 1 ? (named[0] ?? null) : null;
}

function readLearnerTexts(goal: NamingGoal): string[] {
  const details = isJsonObject(goal.details) ? goal.details : {};
  const followUps: unknown[] = Array.isArray(details.followUps) ? details.followUps : [];

  return [
    goal.prompt,
    goal.title,
    details.examName,
    details.targetPosition,
    details.targetNote,
    ...followUps.map((item) => (isJsonObject(item) ? item.answer : null)),
  ].filter((text): text is string => typeof text === "string");
}

/**
 * The options the learner's own words say they take (their goal, its reading and their onboarding
 * answers), for the choices they haven't picked. Once they answered the choice's question, even
 * with "Decide later", nothing is picked for them.
 */
export function findNamedChoices({
  choices,
  goal,
  structure,
}: {
  choices: readonly ExamChoice[];
  goal: NamingGoal;
  structure: ExamStructure;
}): ExamChoice[] {
  const details = isJsonObject(goal.details) ? goal.details : {};

  if (getAnsweredQuestions(details).includes("examChoice")) {
    return [];
  }

  const texts = readLearnerTexts(goal);
  const groups = listChoiceGroups(structure.subjects);
  const options = new Set(groups.flatMap((group) => group.options));

  const subjects = structure.subjects.flatMap((subject) =>
    options.has(subject) ? [] : [subject.name, subject.shortName ?? ""].filter(Boolean),
  );

  return groups.flatMap((group) => {
    const isPicked = choices.some(
      (choice) => choice.group === group.name && findChoiceOption({ choice, structure }),
    );

    const subject = isPicked
      ? null
      : findNamedOption({ language: goal.language, options: group.options, subjects, texts });

    return subject ? [{ group: group.name, subject }] : [];
  });
}
