import { type PracticeItem } from "../session-builder";

export function mixCourseStartPractice({
  units,
  courseStarts,
  studied,
}: {
  units: readonly { questions: PracticeItem[] }[];
  courseStarts: readonly string[];
  studied: ReadonlySet<string>;
}) {
  if (courseStarts.length === 0) {
    return units.flatMap((unit) => unit.questions);
  }

  const rank = new Map(courseStarts.map((id, i) => [id, i]));

  const ranked = units.flatMap((unit) => {
    const question = unit.questions[0];
    const index = question && rank.get(question.skillId);
    return unit.questions.length === 1 && index !== undefined ? [{ index, unit }] : [];
  });

  const pending = ranked.toSorted((a, b) => a.index - b.index).map((entry) => entry.unit);

  const skipped = new Set(pending);
  const ordinary = units.filter((unit) => !skipped.has(unit));

  const due = ordinary.filter((unit) =>
    unit.questions.some((question) => studied.has(question.skillId)),
  );

  if (due.length === 0) {
    return [...pending, ...ordinary].flatMap((unit) => unit.questions);
  }

  const paired = new Set(due.slice(0, pending.length));
  const practice: PracticeItem[] = [];

  for (const [index, unit] of [...paired].entries()) {
    practice.push(...unit.questions, ...(pending[index]?.questions ?? []));
  }

  return [
    ...practice,
    ...ordinary.filter((unit) => !paired.has(unit)).flatMap((unit) => unit.questions),
    ...pending.slice(paired.size).flatMap((unit) => unit.questions),
  ];
}
