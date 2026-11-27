import "server-only";
import { readLatestWrittenMocks } from "../../learner/facts/written-mocks";
import { type WrittenSample, readWrittenSamples } from "../../learner/facts/written-samples";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getPartMaxPoints } from "../../library/exams/part-points";
import { listWrittenTasks } from "../../library/exams/written-tasks";
import { type EstimatedScore } from "../../preparation/estimated-score";
import { namesMatch } from "../_utils/name-match";
import { getWritingDecimals } from "../essays/_utils/writing-decimals";
import { matchesWritingTaskBasis } from "../essays/_utils/writing-task-basis";
import { isNumericWritingRubric } from "../essays/writing-rubric-policy";
import { isWrittenSubject } from "../mocks/written-subject";
import {
  type WritingRange,
  type WrittenTask,
  scaleWritingRange,
  scoreWrittenParts,
  sumRanges,
} from "../scoring/written-points";
import { type WrittenProjection } from "../scoring/written-points-contract";
import { withMockStanding } from "./written-projection-standing";

const RECENT_PROMPTS = 3;
const POINTS_TOLERANCE = 1e-6;

function equalPoints(first: number, second: number): boolean {
  return Math.abs(first - second) < POINTS_TOLERANCE;
}

function projectTask(task: WrittenTask, samples: readonly WrittenSample[]): WritingRange | null {
  const { points } = task;

  if (points === null) {
    return null;
  }

  const used = new Set<string>();
  const ranges: WritingRange[] = [];

  const eligible = samples.filter(
    ({ answer, numericEligible, prompt }) =>
      numericEligible &&
      answer.conditions.version === "firstDraft" &&
      prompt.taskKey === task.key &&
      prompt.unit === "answer" &&
      matchesWritingTaskBasis({ prompt, task }),
  );

  for (const { answer, itemId } of eligible) {
    if (answer.grade.kind === "points" && !used.has(itemId)) {
      used.add(itemId);
      ranges.push(scaleWritingRange(answer.grade.total, (points * task.count) / answer.grade.max));
    }

    if (ranges.length === RECENT_PROMPTS) {
      break;
    }
  }

  const range = sumRanges(ranges);
  return range && scaleWritingRange(range, 1 / ranges.length);
}

export function projectWrittenParts({
  samples,
  structure,
  tasks = listWrittenTasks({ structure }),
}: {
  samples: readonly WrittenSample[];
  structure: ExamStructure | null;
  tasks?: ReturnType<typeof listWrittenTasks>;
}) {
  const numeric = new Set(
    tasks.filter((task) => isNumericWritingRubric(task)).map(({ key }) => key),
  );

  const bySection = Map.groupBy(tasks, ({ section }) => section);

  const parts = scoreWrittenParts({
    rangeForTask: (task) => (numeric.has(task.key) ? projectTask(task, samples) : null),
    structure,
    tasks,
  });

  return parts.map((part) => ({
    ...part,
    decimals: getWritingDecimals(
      part.max,
      bySection.get(part.name)?.map(({ grading }) => grading),
      part.tasks.map(({ max }) => max ?? 0),
    ),
    scale: part.tasks.every(({ key }) => numeric.has(key))
      ? ("points" as const)
      : ("levels" as const),
  }));
}

type ScorePart = { max: number | null; name: string; range: WritingRange | null };
type Part = ScorePart & { objective: boolean };
type Term = { max: number; parts: Part[]; share: number };
type Scoring = NonNullable<ExamStructure["mock"]>["scoring"];

function matchFinalTerms({
  parts,
  shares,
}: {
  parts: readonly Part[];
  shares: NonNullable<Scoring["finalShares"]>;
}): Term[] | null {
  const used = new Set<Part>();

  const terms = shares.map(({ parts: names, share }) => {
    const matched = names.flatMap(
      (name) => parts.find((part) => namesMatch(part.name, name)) ?? [],
    );

    if (
      new Set(matched).size !== names.length ||
      matched.some((part) => part.max === null || used.has(part))
    ) {
      return null;
    }

    matched.forEach((part) => used.add(part));
    const max = matched.reduce((sum, part) => sum + (part.max ?? 0), 0);
    return { max, parts: matched, share };
  });

  if (
    terms.some((term) => term === null) ||
    used.size !== parts.length ||
    !equalPoints(
      shares.reduce((sum, term) => sum + term.share, 0),
      1,
    )
  ) {
    return null;
  }

  return terms.filter((term) => term !== null);
}

function finalMaximum({
  scale,
  terms,
}: {
  scale: Scoring["scale"];
  terms: readonly Term[];
}): number | null {
  if (scale?.fromPercent) {
    return scale.max;
  }

  const first = terms[0];
  const implied = first && first.max / first.share;

  const additive =
    implied !== undefined && terms.every((term) => equalPoints(term.max / term.share, implied));

  return additive && (!scale || (scale.min === 0 && scale.max === implied)) ? implied : null;
}

function combine({
  objective,
  objectives,
  parts,
  structure,
}: {
  objective: WritingRange | null;
  objectives: readonly Omit<ScorePart, "range">[];
  parts: readonly ScorePart[];
  structure: ExamStructure;
}): Pick<WrittenProjection, "combined" | "max"> {
  const scoring = structure.mock?.scoring;
  const scales = scoring?.scale ?? null;

  const terms = matchFinalTerms({
    parts: [
      ...objectives.map((part) => ({ ...part, objective: true, range: null })),
      ...parts.map((part) => ({ ...part, objective: false })),
    ],
    shares: scoring?.finalShares ?? [],
  });

  const max = terms && finalMaximum({ scale: scales, terms });

  if (max === null || !terms) {
    return { combined: null, max: null };
  }

  const linear = scales?.fromPercent;

  const objectiveWeights = terms.flatMap((term) =>
    term.parts.some((part) => part.objective) ? [term.share / term.max] : [],
  );

  const firstWeight = objectiveWeights[0] ?? 0;
  const canUseObjective = objectiveWeights.every((weight) => equalPoints(weight, firstWeight));

  const writtenRanges = terms.flatMap((term) =>
    term.parts
      .filter((part) => !part.objective)
      .map((part) => part.range && scaleWritingRange(part.range, term.share / term.max)),
  );

  const range = sumRanges([
    ...(objectives.length > 0
      ? [objective && canUseObjective ? scaleWritingRange(objective, firstWeight) : null]
      : []),
    ...writtenRanges,
  ]);

  if (!range) {
    return { combined: null, max };
  }

  if (linear && scales) {
    const toScale = (share: number) =>
      Math.min(scales.max, Math.max(scales.min, linear.base + share * 100 * linear.perPercent));

    return { combined: { high: toScale(range.high), low: toScale(range.low) }, max };
  }

  return { combined: scaleWritingRange(range, max), max };
}

/** @internal */
export function projectWritten({
  mocks = [],
  objective,
  samples,
  structure,
}: {
  mocks?: Awaited<ReturnType<typeof readLatestWrittenMocks>>;
  objective: EstimatedScore | null;
  samples: readonly WrittenSample[];
  structure: ExamStructure;
}): WrittenProjection | null {
  const parts = withMockStanding({
    mocks,
    parts: projectWrittenParts({ samples, structure }),
    samples,
  });

  if (parts.length === 0) {
    return null;
  }

  const scoring = structure.mock?.scoring;

  const writtenNames = [
    ...parts.map((part) => part.name),
    ...structure.subjects
      .filter((subject) => isWrittenSubject({ structure, subject }))
      .map((subject) => subject.name),
  ];

  const objectives = (scoring?.parts ?? [])
    .filter((part) => !part.qualifying && !writtenNames.some((name) => namesMatch(part.name, name)))
    .map((part) => ({
      ...part,
      maxPoints: getPartMaxPoints({ marking: scoring?.marking ?? [], part }),
    }));

  const objectiveMax =
    objectives.length > 0 && objectives.every((part) => part.maxPoints !== null)
      ? objectives.reduce((sum, part) => sum + (part.maxPoints ?? 0), 0)
      : null;

  const objectiveRange =
    objective?.scale === "percent" && objectiveMax !== null
      ? scaleWritingRange(objective, objectiveMax / 100)
      : objective && { high: objective.high, low: objective.low };

  const overall =
    objective !== null && objective.scale !== "percent"
      ? { combined: null, max: null }
      : combine({
          objective: objectiveMax === null ? null : objectiveRange,
          objectives: objectives.map((part) => ({ max: part.maxPoints, name: part.name })),
          parts,
          structure,
        });

  return {
    ...overall,
    objective: objectiveRange,
    objectiveMax: objective?.scale === "percent" || objective === null ? objectiveMax : null,
    parts,
  };
}

export async function loadWrittenProjection({
  goalId,
  objective,
  structure,
  userId,
}: {
  goalId: string;
  objective: EstimatedScore | null;
  structure: ExamStructure | null;
  userId: string;
}): Promise<WrittenProjection | null> {
  const tasks = listWrittenTasks({ structure });

  if (!structure || tasks.length === 0) {
    return null;
  }

  const [samples, mocks] = await Promise.all([
    readWrittenSamples({ goalId, userId }),
    tasks.some((task) => isNumericWritingRubric(task))
      ? readLatestWrittenMocks({ goalId, userId })
      : [],
  ]);

  return projectWritten({ mocks, objective, samples, structure });
}
