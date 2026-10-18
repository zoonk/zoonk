"use client";

import { type SyllabusSubject, type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { hasSubjectPages } from "@zoonk/core/view-models/syllabus/subject-pages";
import { useExtracted } from "next-intl";
import { CoverageBar } from "../_components/coverage-bar";
import { useFormatProgressShare } from "../_utils/percent";
import { type SubjectBar, getSubjectBar, getSubjectShare } from "../syllabus/use-subject-progress";
import { useTodayScreen } from "./today-context";
import { isFinished } from "./today-queue";

/** Subjects in sight beside the session; the Plan has every one. */
const SHOWN_SUBJECTS = 5;

/**
 * A subject as Today's aside draws it: its names and its bar's measures. Its topics and chapters
 * stay on the Plan, which lists them: a big exam's ran to about 90 KB in every Today read.
 */
export type TodaySubject = Pick<
  SyllabusSubject,
  | "key"
  | "lessonsDone"
  | "lessonsKnown"
  | "lessonsTotal"
  | "name"
  | "notPlannedReason"
  | "preparation"
  | "shortName"
>;

/** The goal's syllabus as Today reads it: its kind, its lessons and its subjects' rows. */
export type TodaySyllabus = Pick<SyllabusView, "goal" | "kind" | "lessons"> & {
  subjects: TodaySubject[];
};

type SubjectRowView = { bar: SubjectBar; subject: TodaySubject; today: boolean };

/** The subjects today's session still studies, by their short names, as its blocks name them. */
function useTodaySubjects(): Set<string> {
  const { today } = useTodayScreen();

  return new Set(
    today.session.blocks.flatMap((block) =>
      !isFinished(block) && block.subject ? [block.subject] : [],
    ),
  );
}

/**
 * The subjects the Plan lists with a bar, in its order: none when the Plan has no subjects of its
 * own (a language, or a plan from one course), and never one the plan leaves out. Each says
 * whether today's session still studies it.
 */
export function useSubjectRows(syllabus: TodaySyllabus | null): SubjectRowView[] {
  const todaySubjects = useTodaySubjects();

  if (!syllabus || !hasSubjectPages({ goalKind: syllabus.goal.kind, syllabus })) {
    return [];
  }

  // A subject the plan leaves out has no bar, as on the Plan (see `useSubjectProgress`).
  return syllabus.subjects.flatMap((subject) =>
    subject.notPlannedReason
      ? []
      : [{ bar: getSubjectBar(subject), subject, today: todaySubjects.has(subject.shortName) }],
  );
}

/**
 * One subject in one row, as the Plan's subjects have it: its short name (whole in its tooltip,
 * over two lines at most), the same bar and the same share: an exam subject's preparation, another
 * goal's lessons studied or known. A subject today's session still studies says so after its name.
 */
function SubjectRow({ bar, subject, today }: SubjectRowView) {
  const t = useExtracted();
  const formatShare = useFormatProgressShare();

  return (
    <li className="grid min-h-7.5 grid-cols-[minmax(0,1fr)_4.5rem_2.25rem] items-center gap-3 py-1">
      <span className="line-clamp-2 text-[0.8125rem] leading-4" title={subject.name}>
        {subject.shortName}
        {today && (
          <span className="text-muted-foreground ml-1.5 text-[0.625rem] font-medium tracking-[0.06em] uppercase">
            {t("Today")}
          </span>
        )}
      </span>
      <CoverageBar {...bar} />
      <span className="text-muted-foreground text-right font-mono text-xs tabular-nums">
        {formatShare(getSubjectShare(bar))}
      </span>
    </li>
  );
}

/** The goal's subjects as the Plan lists them, the first few, under the card's number. */
export function SubjectRows({ labelledBy, rows }: { labelledBy: string; rows: SubjectRowView[] }) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <ul aria-labelledby={labelledBy} className="flex flex-col">
      {rows.slice(0, SHOWN_SUBJECTS).map((row) => (
        <SubjectRow {...row} key={row.subject.key} />
      ))}
    </ul>
  );
}
