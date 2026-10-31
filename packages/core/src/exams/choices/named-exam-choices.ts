import { type Goal } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { toNameWords } from "@zoonk/utils/name-words";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getAnsweredQuestions } from "../../view-models/onboarding/onboarding-steps";
import { type ExamChoice, findChoiceOption, listChoiceGroups } from "./exam-choices";

type Option = Pick<ExamStructure["subjects"][number], "name" | "shortName">;

function toPhrase(text: string): string {
  return ` ${toNameWords(text).join(" ")} `;
}

function saysOption({ option, said }: { option: Option; said: string }): boolean {
  return [option.name, option.shortName ?? ""].some((name) => {
    const phrase = toPhrase(name);
    return phrase.trim() !== "" && said.includes(phrase);
  });
}

function namesOption({ option, said }: { option: Option; said: string }): boolean {
  return [option.name, option.shortName ?? ""].some((name) => {
    const phrase = toPhrase(name);
    return phrase.trim() !== "" && phrase === said;
  });
}

/**
 * The reading's position may hold more than the option ("Auditor de TI, desenvolvimento de
 * sistemas"); a typed answer must be the option's name, since nothing filtered what it rejects or
 * doubts ("possivelmente Auditoria").
 */
function findNamedOption({
  options,
  read,
  typed,
}: {
  options: readonly Option[];
  read: readonly string[];
  typed: readonly string[];
}): string | null {
  const readPhrases = read.map((text) => toPhrase(text));
  const typedPhrases = typed.map((text) => toPhrase(text));

  const named = options.filter(
    (option) =>
      readPhrases.some((said) => saysOption({ option, said })) ||
      typedPhrases.some((said) => namesOption({ option, said })),
  );

  return named.length === 1 ? (named[0]?.name ?? null) : null;
}

/**
 * Only what the learner stated as theirs: the goal's own words can name an option for another
 * goal or with doubt, which the goal reading leaves out of the position it records. The position
 * is the reading's while it still holds the value the reading wrote; a target answer or an edit
 * on the understood screen replaces it with the learner's own typing.
 */
function readStatedTexts(details: Record<string, unknown>): { read: string[]; typed: string[] } {
  const followUps: unknown[] = Array.isArray(details.followUps) ? details.followUps : [];
  const position = typeof details.targetPosition === "string" ? details.targetPosition : null;
  const fromReading = position !== null && position === details.positionFromReading;

  return {
    read: fromReading ? [position] : [],
    typed: [
      fromReading ? null : position,
      details.targetNote,
      ...followUps.map((item) => (isJsonObject(item) ? item.answer : null)),
    ].filter((text): text is string => typeof text === "string"),
  };
}

/**
 * The options the learner states they take (the position the goal reading recorded, and their
 * target and follow-up answers), for the choices they haven't picked. Once they answered the
 * choice's question, even with "Decide later", nothing is picked for them.
 */
export function findNamedChoices({
  choices,
  goal,
  structure,
}: {
  choices: readonly ExamChoice[];
  goal: Pick<Goal, "details">;
  structure: ExamStructure;
}): ExamChoice[] {
  const details = isJsonObject(goal.details) ? goal.details : {};

  if (getAnsweredQuestions(details).includes("examChoice")) {
    return [];
  }

  const { read, typed } = readStatedTexts(details);

  return listChoiceGroups(structure.subjects).flatMap((group) => {
    const isPicked = choices.some(
      (choice) => choice.group === group.name && findChoiceOption({ choice, structure }),
    );

    const subject = isPicked ? null : findNamedOption({ options: group.options, read, typed });
    return subject ? [{ group: group.name, subject }] : [];
  });
}
