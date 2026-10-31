import { type ItemFormat } from "@zoonk/db";
import { apportion } from "@zoonk/utils/apportion";
import { type ExamStructure, type MarkingRow } from "../../library/exams/blueprint-contract";
import { getMarkingPenalty } from "../../library/exams/marking-penalty";
import {
  getPartMaxPoints,
  getPartPointsPerQuestion,
  getPointsPerQuestion,
} from "../../library/exams/part-points";
import { listCountedSubjects } from "../choices/exam-choices";
import { getWrongPenalty } from "../scoring/mock-scoring";
import { getChoiceFormatKey, getFormatSelection } from "./mock-format-mix";
import { findAreaSubject } from "./mock-options";
import { type MockCandidate, type MockPlan, getPlannedItemIds } from "./mock-plan";
import { type ItemMarking, type MockMarking } from "./mock-points-contract";
import { isWrittenSubject } from "./written-subject";

type Subject = ExamStructure["subjects"][number];
type Scoring = NonNullable<ExamStructure["mock"]>["scoring"];
type PlannedItem = Pick<MockCandidate, "area" | "itemFormat" | "itemId" | "format">;
type MarkedParts = MockMarking["parts"];

const PART_SPECIFICITY = 4;

const POINTS_METHODS = new Set<Scoring["method"]>(["raw", "wrongCancelsRight"]);

const ROW_FORMATS: Partial<Record<ItemFormat, MarkingRow["format"]>> = {
  multipleChoice: "multipleChoice",
  numeric: "numeric",
  trueFalse: "trueFalse",
  typed: "shortAnswer",
};

function rankPart({ row, subject }: { row: MarkingRow; subject: Subject | undefined }) {
  if (row.part === null) {
    return 0;
  }

  if (row.part === subject?.name) {
    return 2;
  }

  return row.part === subject?.group ? 1 : null;
}

/** The most specific row wins: the subject's own name, then its group, then the whole exam. */
function rankRow({
  format,
  selection,
  row,
  subject,
}: {
  format: MarkingRow["format"];
  selection: string;
  row: MarkingRow;
  subject: Subject | undefined;
}): number | null {
  const partRank = rankPart({ row, subject });

  if (partRank === null || (row.format !== null && row.format !== format)) {
    return null;
  }

  const choiceKey =
    row.format === "multipleChoice" && row.select !== undefined && row.select !== null
      ? getChoiceFormatKey(row.select)
      : null;

  if (choiceKey !== null && selection !== choiceKey) {
    return null;
  }

  const selectionRank = choiceKey === null ? 0 : 1;

  return partRank * PART_SPECIFICITY + (row.format === null ? 0 : 2) + selectionRank;
}

function findRows({
  format,
  selection,
  rows,
  subject,
}: {
  format: MarkingRow["format"];
  selection: string;
  rows: readonly MarkingRow[];
  subject: Subject | undefined;
}): MarkingRow[] {
  const ranked = rows.flatMap((row) => {
    const rank = rankRow({ format, row, selection, subject });
    return rank === null ? [] : [{ rank, row }];
  });

  const best = Math.max(-1, ...ranked.map((entry) => entry.rank));
  return ranked.filter((entry) => entry.rank === best).map((entry) => entry.row);
}

/** Rows that share a part and format split their items by the notice's counts, in its order. */
function fillRows<T>({ items, rows }: { items: readonly T[]; rows: readonly MarkingRow[] }) {
  const [first] = rows;

  if (rows.length <= 1 || rows.some((row) => row.questions === null)) {
    return items.map((item) => ({ item, row: first }));
  }

  const counts = apportion({ total: items.length, weights: rows.map((row) => row.questions ?? 0) });

  const ends = counts.map((_, index) =>
    counts.slice(0, index + 1).reduce((sum, count) => sum + count, 0),
  );

  return items.map((item, position) => ({
    item,
    row: rows[ends.findIndex((end) => position < end)] ?? first,
  }));
}

function findPart({ parts, subject }: { parts: MarkedParts; subject: Subject | undefined }) {
  if (!subject) {
    return null;
  }

  const names = new Set(parts.map((part) => part.name));
  const keys = [subject.group, subject.name].filter((key) => typeof key === "string");

  return keys.find((key) => names.has(key)) ?? keys[0] ?? null;
}

function markItems({
  items,
  parts,
  structure,
}: {
  items: readonly PlannedItem[];
  parts: MarkedParts;
  structure: ExamStructure;
}): Record<string, ItemMarking> {
  const rows = structure.mock?.scoring.marking ?? [];
  const wrongPenalty = getWrongPenalty(structure);
  const areas = [...new Set(items.flatMap((item) => item.area ?? []))];
  const subjects = new Map(areas.map((area) => [area, findAreaSubject({ area, structure })]));

  const matched = items.map((item) => {
    const subject = item.area ? subjects.get(item.area) : undefined;

    const found = findRows({
      format: ROW_FORMATS[item.itemFormat] ?? null,
      rows,
      selection: getFormatSelection(item.format ?? null),
      subject,
    });

    return { found, item, part: findPart({ parts, subject }) };
  });

  const groups = Map.groupBy(matched, (entry) =>
    entry.found.map((row) => rows.indexOf(row)).join(","),
  );

  return Object.fromEntries(
    [...groups.values()].flatMap((group) =>
      fillRows({ items: group, rows: group[0]?.found ?? [] }).map(({ item, row }) => [
        item.item.itemId,
        {
          part: item.part,
          points:
            row?.points ??
            (item.part ? getPartPointsPerQuestion({ name: item.part, structure }) : null) ??
            1,
          wrongPenalty: (row ? getMarkingPenalty(row) : null) ?? wrongPenalty,
        },
      ]),
    ),
  );
}

function isWrittenPart({ name, structure }: { name: string; structure: ExamStructure }) {
  const subjects = structure.subjects.filter(
    (subject) => subject.group === name || subject.name === name,
  );

  return subjects.length > 0
    ? subjects.every((subject) => isWrittenSubject({ structure, subject }))
    : (structure.mock?.sections ?? []).some(
        (section) => section.kind === "written" && section.name === name,
      );
}

function sumKnown(values: readonly (number | null)[]): number | null {
  return values.length > 0 && values.every((value) => value !== null)
    ? values.reduce((sum, value) => sum + value, 0)
    : null;
}

function getExamMaxPoints({
  rows,
  scoring,
  structure,
}: {
  rows: readonly MarkingRow[];
  scoring: Scoring;
  structure: ExamStructure;
}): number | null {
  const qualifying = new Set(
    (scoring.parts ?? []).flatMap((part) => (part.qualifying ? [part.name] : [])),
  );

  const counted = rows.filter((row) => row.part === null || !qualifying.has(row.part));

  if (counted.length > 0 && counted.every((row) => row.questions !== null)) {
    return counted.reduce((sum, row) => sum + (row.questions ?? 0) * row.points, 0);
  }

  const points = getPointsPerQuestion(counted);
  const questions = structure.mock?.totalQuestions ?? null;

  return qualifying.size === 0 && questions !== null && points !== null ? questions * points : null;
}

function getTotalMaxPoints({
  parts,
  scoring,
  structure,
}: {
  parts: MarkedParts;
  scoring: Scoring;
  structure: ExamStructure;
}): number | null {
  const counted = parts.filter((part) => part.objective && !part.qualifying);

  const max =
    counted.length > 0
      ? sumKnown(counted.map((part) => part.maxPoints))
      : getExamMaxPoints({ rows: scoring.marking ?? [], scoring, structure });

  return max !== null && max > 0 ? max : null;
}

/** Only exams scored by right answers or by net points get points; IRT and scaled ones keep theirs. */
function toMockMarking({
  items,
  structure,
}: {
  items: readonly PlannedItem[];
  structure: ExamStructure | null;
}): MockMarking | null {
  const scoring = structure?.mock?.scoring;

  if (!structure || !scoring || !POINTS_METHODS.has(scoring.method)) {
    return null;
  }

  const rows = scoring.marking ?? [];

  const parts = (scoring.parts ?? []).map((part) => ({
    maxPoints: getPartMaxPoints({ marking: rows, part }),
    minimum: part.minimum,
    name: part.name,
    objective: !isWrittenPart({ name: part.name, structure }),
    qualifying: part.qualifying,
    questions: part.questions,
  }));

  const missing =
    parts.length > 0
      ? structure.subjects
          .flatMap((subject) => {
            const name = findPart({ parts, subject });

            if (
              !name ||
              isWrittenSubject({ structure, subject }) ||
              parts.some((part) => part.name === name)
            ) {
              return [];
            }

            const subjects = structure.subjects.filter(
              (item) =>
                findPart({ parts, subject: item }) === name &&
                !isWrittenSubject({ structure, subject: item }),
            );

            const places = listCountedSubjects(subjects);

            const questions = places.every((item) => item.questions !== null)
              ? places.reduce((sum, item) => sum + (item.questions ?? 0), 0)
              : null;

            const part = {
              maxPoints: null,
              minimum: null,
              name,
              objective: true,
              qualifying: false,
              questions,
            };

            return [{ ...part, maxPoints: getPartMaxPoints({ marking: rows, part }) }];
          })
          .filter(
            (part, index, all) => all.findIndex((other) => other.name === part.name) === index,
          )
      : [];

  const allParts = [...parts, ...missing];

  return {
    items: markItems({ items, parts: allParts, structure }),
    maxPoints: getTotalMaxPoints({ parts: allParts, scoring, structure }),
    parts: allParts,
    totalMinimum: scoring.totalMinimum
      ? { unit: scoring.totalMinimum.unit, value: scoring.totalMinimum.value }
      : null,
  };
}

/** Marks every item the plan may ask, both routes of an adaptive module included. */
export function markPlannedItems({
  candidates,
  plan,
  structure,
}: {
  candidates: readonly PlannedItem[];
  plan: MockPlan;
  structure: ExamStructure | null;
}): { marking: MockMarking } | null {
  const byId = new Map(candidates.map((candidate) => [candidate.itemId, candidate]));
  const items = getPlannedItemIds(plan).flatMap((itemId) => byId.get(itemId) ?? []);
  const marking = toMockMarking({ items, structure });

  return marking ? { marking } : null;
}
