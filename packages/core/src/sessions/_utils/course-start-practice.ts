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
  if (courseStarts.length === 0) {return units.flatMap((unit) => unit.questions);}
  const rank = new Map(courseStarts.map((id, i) => [id, i]));

  const pending = units
    .filter((unit) => unit.questions.length === 1 && rank.has(unit.questions[0]!.skillId))
    .toSorted((a, b) => rank.get(a.questions[0]!.skillId)! - rank.get(b.questions[0]!.skillId)!);

  const skipped = new Set(pending);
  const ordinary = units.filter((unit) => !skipped.has(unit));

  const due = ordinary.filter((unit) =>
    unit.questions.some((question) => studied.has(question.skillId)),
  );

  if (due.length === 0) {return [...pending, ...ordinary].flatMap((unit) => unit.questions);}
  const paired = new Set(due.slice(0, pending.length));
  const practice: PracticeItem[] = [];
  let index = 0;

  for (const unit of paired) {
    practice.push(...unit.questions, ...pending[index++]!.questions);
  }

  return [
    ...practice,
    ...ordinary.filter((unit) => !paired.has(unit)).flatMap((unit) => unit.questions),
    ...pending.slice(index).flatMap((unit) => unit.questions),
  ];
}
