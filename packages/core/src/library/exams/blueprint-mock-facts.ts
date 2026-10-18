import { type BlueprintExtraction } from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint";
import { type FactEntry, type FactSource, toFacts } from "./blueprint-fact-claims";
import {
  type ExtractionDocument,
  type Passage,
  toPartPassages,
  uniquePassages,
} from "./blueprint-passages";

type Mock = NonNullable<BlueprintExtraction["mock"]>;
type Task = Mock["sections"][number]["tasks"][number];

const SCORING_WORDS: Record<Exclude<Mock["scoring"]["method"], "other">, string> = {
  itemResponseTheory: "scored with item response theory",
  raw: "the score is the number or share of right answers",
  scaled: "the result is reported on a score scale, such as bands or points",
  wrongCancelsRight: "a wrong answer loses points",
};

function describeScoring(scoring: Mock["scoring"]): string {
  return scoring.method === "other" ? scoring.description : SCORING_WORDS[scoring.method];
}

/** The notice's scale in one sentence, for its own claim. */
function describeScale(scale: NonNullable<Mock["scoring"]["scale"]>): string {
  const name = scale.name ? `${scale.name}, ` : "";
  const pass = scale.passScore === null ? "" : `; ${scale.passScore} passes`;

  const conversion = scale.fromPercent
    ? `; the score is ${scale.fromPercent.base} plus ${scale.fromPercent.perPercent} per percent of right answers`
    : "";

  return `The result is reported on a scale (${name}from ${scale.min} to ${scale.max})${pass}${conversion}`;
}

/** How a section's navigation differs from moving freely, in one sentence for its claim. */
function describeNavigation(
  name: string,
  navigation: NonNullable<Mock["sections"][number]["navigation"]>,
): string {
  const rules = [
    navigation.forwardOnly && "a question can't be returned to once left",
    navigation.itemSeconds !== null && `each question has ${navigation.itemSeconds} seconds`,
    navigation.mustAnswer && "a question must be answered before the next one shows",
    navigation.answerChanges !== null &&
      `a review at its end may change up to ${navigation.answerChanges} answers`,
  ].filter((rule) => typeof rule === "string");

  return `${name}: ${rules.join("; ")}`;
}

/**
 * A recording part as a claim about it names it: the line it quotes for itself, like a format.
 * Never the description, which the model writes and its own claim checks: a detail it adds that
 * no line states (a setting the notice gives for several parts at once) would drop every claim
 * that names the part with it.
 */
function namePart({ task, taskIndex }: { task: Task; taskIndex: number }): string {
  const own = task.passages[0];
  return own ? `the recording part quoted as "${own.passage}"` : `recording part ${taskIndex + 1}`;
}

/**
 * What a section asks, one task each: a written task, kept by its count and description, or a
 * recording part, kept by its questions, with how often it's played and its description as claims
 * of their own. Each reads its own passages (a format page lists the parts, their questions and
 * their plays in separate sentences, away from the section's summary) and the section's.
 */
function taskFacts({
  documents,
  id,
  name,
  passages,
  section,
}: {
  documents: ExtractionDocument[];
  id: string;
  name: string;
  passages: Passage[];
  section: Mock["sections"][number];
}): FactEntry[] {
  const isListening = section.kind === "listening";

  return section.tasks.flatMap((task, taskIndex) => {
    const taskId = `${id}.tasks.${taskIndex}`;
    const part = `${name}: ${namePart({ task, taskIndex })}`;

    return toFacts({
      claims: [
        isListening
          ? { id: taskId, statement: `${part} has ${task.count} questions` }
          : { id: taskId, statement: `${name} asks ${task.count} × ${task.description}` },
        isListening && {
          id: `${taskId}.description`,
          statement: `${name} has a recording part: ${task.description}`,
        },
        task.plays !== null && {
          id: `${taskId}.plays`,
          statement: `${part} is played ${task.plays} time${task.plays === 1 ? "" : "s"}`,
        },
      ],
      documents,
      // The section's passages include the task's own that name the section.
      passages: uniquePassages([...task.passages, ...passages]),
    });
  });
}

/**
 * A section's claims read its own passages, the mock's and the found ones naming the section, like
 * a subject's: a format page states a section's time and count under its own heading, which a
 * summary line ("Summary … Number of questions: 40") doesn't name.
 */
function sectionFacts({
  documents,
  found,
  mock,
}: {
  documents: ExtractionDocument[];
  found: Passage[];
  mock: Mock;
}): FactEntry[] {
  return mock.sections.flatMap((section, index) => {
    const id = `mock.sections.${index}`;
    const name = `Exam section "${section.name}"`;

    const passages = toPartPassages({
      found,
      name: section.name,
      own: [...section.passages, ...mock.passages],
    });

    const claims = toFacts({
      claims: [
        { id, statement: name },
        section.questions !== null && {
          id: `${id}.questions`,
          statement: `${name} has ${section.questions} questions`,
        },
        section.minutes !== null && {
          id: `${id}.minutes`,
          statement: `${name} lasts ${section.minutes} minutes`,
        },
        section.day !== null && {
          id: `${id}.day`,
          statement: `${name} is on exam day ${section.day}`,
        },
        Boolean(section.tools) && {
          id: `${id}.tools`,
          statement: `${name} allows or gives: ${section.tools}`,
        },
        typeof section.breakAfterMinutes === "number" && {
          id: `${id}.breakAfterMinutes`,
          statement: `${name} is followed by a break of ${section.breakAfterMinutes} minutes`,
        },
        section.navigation !== null && {
          id: `${id}.navigation`,
          statement: describeNavigation(name, section.navigation),
        },
      ],
      documents,
      passages,
    });

    return [...claims, ...taskFacts({ documents, id, name, passages, section })];
  });
}

/**
 * The conditions a mock copies, one claim each: a notice states them in several places, and a
 * derived detail (a day's length given to one section) shouldn't drop the scoring with it.
 */
export function mockFacts({ documents, extraction, found }: FactSource): FactEntry[] {
  const { mock } = extraction;

  if (!mock) {
    return [];
  }

  const conditions = toFacts({
    claims: [
      { id: "mock.scoring", statement: `Scoring: ${describeScoring(mock.scoring)}` },
      mock.scoring.method !== "other" && {
        id: "mock.scoring.description",
        statement: `Scoring: ${mock.scoring.description}`,
      },
      mock.scoring.relative && {
        id: "mock.scoring.relative",
        statement: "The result depends on how the other candidates do",
      },
      mock.scoring.method === "wrongCancelsRight" &&
        typeof mock.scoring.wrongPenalty === "number" && {
          id: "mock.scoring.wrongPenalty",
          statement: `Each wrong answer takes away ${mock.scoring.wrongPenalty} of a right answer's points`,
        },
      mock.scoring.scale !== null && {
        id: "mock.scoring.scale",
        statement: describeScale(mock.scoring.scale),
      },
      mock.totalQuestions !== null && {
        id: "mock.totalQuestions",
        statement: `The exam has ${mock.totalQuestions} questions in total`,
      },
      mock.timeLimitMinutes !== null && {
        id: "mock.timeLimitMinutes",
        statement: `The exam lasts ${mock.timeLimitMinutes} minutes in total`,
      },
      mock.order !== null && { id: "mock.order", statement: `The exam's order: ${mock.order}` },
      mock.adaptive && {
        id: "mock.adaptive",
        statement: "A later section's questions depend on the results of an earlier one",
      },
    ],
    documents,
    passages: mock.passages,
  });

  return [...conditions, ...sectionFacts({ documents, found, mock })];
}
