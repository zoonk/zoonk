import { type BlueprintExtraction } from "@zoonk/ai/tasks/research/extract-exam-blueprint";
import { type FactEntry, type FactSource, toFacts } from "./blueprint-fact-claims";
import {
  type ExtractionDocument,
  type Passage,
  toPartPassages,
  uniquePassages,
} from "./blueprint-passages";
import { pointsFacts } from "./blueprint-points-facts";
import { writtenRuleFacts } from "./blueprint-written-facts";

type Mock = NonNullable<BlueprintExtraction["mock"]>;
type Task = Mock["sections"][number]["tasks"][number];

const SCORING_WORDS: Record<Exclude<Mock["scoring"]["method"], "other">, string> = {
  itemResponseTheory: "scored with item response theory",
  raw: "the score is the number or share of right answers",
  scaled: "the result is reported on a score scale, such as bands or points",
  wrongCancelsRight: "a wrong answer loses points",
};

/** Boards count true-false "itens"; mocks size objective sittings from it, so written tasks stay out. */
function describeQuestionTotal({ mock, total }: { mock: Mock; total: number }) {
  const written = mock.sections.some((section) => section.kind === "written");
  return `The exam has ${total} questions or items in total${written ? ", not counting its written tasks" : ""}`;
}

function describeScoring(scoring: Mock["scoring"]): string {
  return scoring.method === "other" ? scoring.description : SCORING_WORDS[scoring.method];
}

function describeScale(scale: NonNullable<Mock["scoring"]["scale"]>): string {
  const name = scale.name ? `${scale.name}, ` : "";
  const pass = scale.passScore === null ? "" : `; ${scale.passScore} passes`;

  const conversion = scale.fromPercent
    ? `; the score is ${scale.fromPercent.base} plus ${scale.fromPercent.perPercent} per percent of right answers`
    : "";

  return `The result is reported on a scale (${name}from ${scale.min} to ${scale.max})${pass}${conversion}`;
}

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

function namePart({ task, taskIndex }: { task: Task; taskIndex: number }): string {
  const own = task.passages[0];
  return own ? `the recording part quoted as "${own.passage}"` : `recording part ${taskIndex + 1}`;
}

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

    const facts = toFacts({
      claims: [
        isListening
          ? { id: taskId, statement: `${part} has ${task.count} questions` }
          : { id: taskId, statement: `${name} asks ${task.count} × ${task.description}` },
        isListening && {
          id: `${taskId}.description`,
          statement: `${name} has a recording part: ${task.description}`,
        },
        Boolean(task.officialIdentifier) && {
          id: `${taskId}.officialIdentifier`,
          statement: `${task.description} is identified as "${task.officialIdentifier}"`,
        },
        typeof task.lines === "number" && {
          id: `${taskId}.lines`,
          statement: `${task.description} has a maximum of ${task.lines} lines per answer`,
        },
        typeof task.points === "number" && {
          id: `${taskId}.points`,
          statement: `${task.description} is worth ${task.points} points per answer`,
        },
        Boolean(task.subjects?.length) && {
          id: `${taskId}.subjects`,
          statement: `${task.description} asks about: ${task.subjects?.join("; ")}`,
        },
        typeof task.handwritten === "boolean" && {
          id: `${taskId}.handwritten`,
          statement: `${task.description} ${task.handwritten ? "is handwritten" : "is explicitly not handwritten"}`,
        },
        task.plays !== null && {
          id: `${taskId}.plays`,
          statement: `${part} is played ${task.plays} time${task.plays === 1 ? "" : "s"}`,
        },
      ],
      documents,
      passages: uniquePassages([...task.passages, ...passages]),
    });

    return [...facts, ...writtenRuleFacts({ documents, id: taskId, task })];
  });
}

/** A day number counts the notice's exam dates, so its claim reads them all. */
function listExamDayPassages({ extraction, found }: FactSource): Passage[] {
  return found.filter((passage) =>
    extraction.dates.some(
      (date) =>
        date.kind === "exam" &&
        date.document === passage.document &&
        date.passage === passage.passage,
    ),
  );
}

function sectionFacts({
  documents,
  extraction,
  found,
  mock,
}: FactSource & { mock: Mock }): FactEntry[] {
  const examDays = listExamDayPassages({ documents, extraction, found });

  return mock.sections.flatMap((section, index) => {
    const id = `mock.sections.${index}`;
    const name = `Exam section "${section.name}"`;

    const passages = toPartPassages({
      found,
      name: section.name,
      own: [...section.passages, ...mock.passages],
    });

    const dayClaims = toFacts({
      claims: [
        section.minutes !== null && {
          id: `${id}.minutes`,
          statement: `The sitting for ${name}${section.day === null ? "" : ` on exam day ${section.day}`} lasts ${section.minutes} minutes`,
        },
        section.day !== null && {
          id: `${id}.day`,
          statement: `${name} is on exam day ${section.day}`,
        },
      ],
      documents,
      passages: section.day === null ? passages : uniquePassages([...passages, ...examDays]),
    });

    const claims = toFacts({
      claims: [
        { id, statement: name },
        section.questions !== null && {
          id: `${id}.questions`,
          statement: `${name} has ${section.questions} questions`,
        },
        Boolean(section.session) && {
          id: `${id}.session`,
          statement: `${name} takes place in the "${section.session}" session`,
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

    return [...claims, ...dayClaims, ...taskFacts({ documents, id, name, passages, section })];
  });
}

export function mockFacts({ documents, extraction, found }: FactSource): FactEntry[] {
  const { mock } = extraction;

  if (!mock) {
    return [];
  }

  const scoring = toFacts({
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
    ],
    documents,
    passages: uniquePassages([
      ...mock.passages,
      ...mock.scoring.marking.flatMap((row) => row.passages),
    ]),
  });

  const conditions = toFacts({
    claims: [
      mock.totalQuestions !== null && {
        id: "mock.totalQuestions",
        statement: describeQuestionTotal({ mock, total: mock.totalQuestions }),
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

  return [
    ...scoring,
    ...conditions,
    ...pointsFacts({ documents, found, scoring: mock.scoring }),
    ...sectionFacts({ documents, extraction, found, mock }),
  ];
}
