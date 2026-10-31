import { type BlueprintExtraction } from "@zoonk/ai/tasks/research/extract-exam-blueprint";
import { FORMAT_WORDS, type FactEntry, toFacts } from "./blueprint-fact-claims";
import { type ExtractionDocument, type Passage, toPartPassages } from "./blueprint-passages";

type Scoring = NonNullable<BlueprintExtraction["mock"]>["scoring"];
type MarkingRow = Scoring["marking"][number];
type Minimum = { unit: "percent" | "points"; value: number };

function describePoints(points: number): string {
  return `${points} ${points === 1 ? "point" : "points"}`;
}

function describeSelection(row: MarkingRow): string {
  if (row.format !== "multipleChoice" || row.select === null) {
    return "";
  }

  return row.select === 1 ? ", single choice" : `, select ${row.select}`;
}

function describeRowScope(row: MarkingRow): string {
  const part = row.part ? `"${row.part}"` : "the whole exam";
  return row.format ? `${part} (${FORMAT_WORDS[row.format]}${describeSelection(row)})` : part;
}

function describePenalty(row: MarkingRow & { wrongPenalty: number }): string {
  if (row.wrongPenalty === 0) {
    return "a wrong answer costs no points";
  }

  return `each wrong answer takes away exactly ${describePoints(row.wrongPenalty)}`;
}

type PointsSource = { documents: ExtractionDocument[]; found: Passage[]; scoring: Scoring };

function markingFacts({ documents, found, scoring }: PointsSource): FactEntry[] {
  return scoring.marking.flatMap((row, index) => {
    const id = `mock.scoring.marking.${index}`;
    const scope = describeRowScope(row);

    return toFacts({
      claims: [
        { id, statement: `In ${scope}, a right answer earns ${describePoints(row.points)}` },
        row.questions !== null && {
          id: `${id}.questions`,
          statement: `In ${scope}, ${row.questions} questions are worth ${describePoints(row.points)} each`,
        },
        row.wrongPenalty !== null && {
          id: `${id}.wrongPenalty`,
          statement: `In ${scope}, ${describePenalty({ ...row, wrongPenalty: row.wrongPenalty })}`,
        },
      ],
      documents,
      passages: row.part
        ? toPartPassages({ found, name: row.part, own: row.passages })
        : row.passages,
    });
  });
}

function describeMinimum({ minimum, part }: { minimum: Minimum; part: string }): string {
  const least =
    minimum.unit === "percent"
      ? `${minimum.value}% of the points of`
      : `${describePoints(minimum.value)} in`;

  return `Any candidate who scores less than ${least} ${part} is eliminated`;
}

function partFacts({ documents, found, scoring }: PointsSource): FactEntry[] {
  return scoring.parts.flatMap((part, index) => {
    const id = `mock.scoring.parts.${index}`;
    const name = `"${part.name}"`;

    return toFacts({
      claims: [
        part.questions !== null && {
          id: `${id}.questions`,
          statement: `${name} has ${part.questions} questions`,
        },
        part.maxPoints !== null && {
          id: `${id}.maxPoints`,
          statement: `${name} gives at most ${describePoints(part.maxPoints)}`,
        },
        part.minimum !== null && {
          id: `${id}.minimum`,
          statement: describeMinimum({ minimum: part.minimum, part: name }),
        },
        part.qualifying && {
          id: `${id}.qualifying`,
          statement: `${name} only has to reach its minimum: its marks don't count toward the result or the ranking`,
        },
      ],
      documents,
      passages: toPartPassages({ found, name: part.name, own: part.passages }),
    });
  });
}

export function pointsFacts({ documents, found, scoring }: PointsSource): FactEntry[] {
  const { totalMinimum } = scoring;

  return [
    ...markingFacts({ documents, found, scoring }),
    ...partFacts({ documents, found, scoring }),
    ...(totalMinimum
      ? toFacts({
          claims: [
            {
              id: "mock.scoring.totalMinimum",
              statement: describeMinimum({
                minimum: totalMinimum,
                part: "the objective tests that count, added together,",
              }),
            },
          ],
          documents,
          passages: totalMinimum.passages,
        })
      : []),
  ];
}
