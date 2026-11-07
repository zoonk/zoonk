"use client";

import { type PlanView } from "@zoonk/core/plans/view-contract";
import { useExtracted, useFormatter } from "next-intl";
import { PageSectionFooter } from "../_components/page";

export type SharedExams = Pick<PlanView, "areas" | "sharedExams">;

const MAX_NAMED_EXAMS = 2;

function useExamNames() {
  const format = useFormatter();

  return function examNames(exams: readonly { name: string }[]): string | null {
    return exams.length > MAX_NAMED_EXAMS
      ? null
      : format.list(
          exams.map((exam) => exam.name),
          { type: "conjunction" },
        );
  };
}

export function SharedExamsNote({ shared }: { shared: SharedExams }) {
  const t = useExtracted();
  const examNames = useExamNames();
  const count = shared.sharedExams.length;
  const exams = examNames(shared.sharedExams);

  if (count === 0) {
    return null;
  }

  return (
    <PageSectionFooter data-slot="shared-exams">
      {exams
        ? t({
            description:
              "On one exam's plan. {exams} names the learner's other exams that test some of the same topics.",
            message:
              "{count, plural, one {Topics shared with {exams} count for both exams, so you study them once.} other {Topics shared with {exams} count for every exam that has them, so you study them once.}}",
            values: { count, exams },
          })
        : t({
            description:
              "On one exam's plan, when the learner has several other exams that test some of the same topics.",
            message:
              "{count, plural, one {Topics shared with your # other exam count for both exams, so you study them once.} other {Topics shared with your # other exams count for every exam that has them, so you study them once.}}",
            values: { count },
          })}{" "}
      {t("Practice stays in each exam's style.")}
    </PageSectionFooter>
  );
}

export function SharedExamsLine({ areas, shared }: { areas: string[]; shared: SharedExams }) {
  const t = useExtracted();
  const examNames = useExamNames();

  const goalIds = new Set(
    shared.areas.filter((area) => areas.includes(area.name)).flatMap((area) => area.sharedWith),
  );

  const alsoIn = shared.sharedExams.filter((exam) => goalIds.has(exam.goalId));
  const exams = examNames(alsoIn);

  if (alsoIn.length === 0) {
    return null;
  }

  return (
    <span
      className="text-muted-foreground text-xs @lg/subjects:truncate"
      data-slot="shared-exams-line"
    >
      {exams
        ? t({
            description:
              "Marks a subject on one exam's plan that the learner's other exams named in {exams} also test.",
            message: "Also in {exams}",
            values: { exams },
          })
        : t({
            description:
              "Marks a subject on one exam's plan that the learner's other exams also test.",
            message: "{count, plural, one {Also in # exam} other {Also in # exams}}",
            values: { count: alsoIn.length },
          })}
    </span>
  );
}
