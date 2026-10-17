"use client";

import { type SyllabusSubject, type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { hasSubjectPages } from "@zoonk/core/view-models/syllabus/subject-pages";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { Fragment } from "react";
import { CoverageBar, CoverageLegend } from "../_components/coverage-bar";
import { LIST_GROUP_CLASS, ListRowLink, ListRowTrailing } from "../_components/list-group";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { useFormatProgressShare } from "../_utils/percent";
import { type SubjectGroup, groupSubjects } from "./group-subjects";
import { CourseWeightsNote, QuestionsSourceNote, useGroupName } from "./syllabus-notes";
import { getSubjectShare, useSubjectProgress } from "./use-subject-progress";

const SECTION_TITLE_ID = "journey-syllabus-title";

/**
 * Whether a goal's structure is worth its own section: when its subjects have pages of their own
 * (an exam's notice, or at least two modules).
 */
export function hasSyllabusSection(syllabus: SyllabusView | null): syllabus is SyllabusView {
  return syllabus !== null && hasSubjectPages({ goalKind: syllabus.goal.kind, syllabus });
}

/** "Subjects" for an exam, "Modules" for a plan's own areas. */
function useSectionTitle(syllabus: SyllabusView): string {
  const t = useExtracted();
  return syllabus.goal.kind === "exam" ? t("Subjects") : t("Modules");
}

/** "5 subjects · 46 topics": what the list holds, in the note under it. */
function useSectionCount(syllabus: SyllabusView): string {
  const t = useExtracted();
  const subjects = syllabus.subjects.filter((subject) => subject.source === "notice").length;

  // The learner's material is never a notice: its topics (or its headings when it lists only
  // those) are counted as the reveal counts them.
  if (syllabus.fromMaterial) {
    return t(
      "{count, plural, one {# topic from your material} other {# topics from your material}}",
      { count: syllabus.topicCount > 0 ? syllabus.topicCount : subjects },
    );
  }

  if (syllabus.kind === "notice" && syllabus.topicCount > 0) {
    return t(
      "{subjects, plural, one {# subject} other {# subjects}} · {topics, plural, one {# topic} other {# topics}}",
      { subjects, topics: syllabus.topicCount },
    );
  }

  // The notice's own subjects, as the reveal counts them: the plan's extras aren't the exam's.
  if (syllabus.goal.kind === "exam") {
    return t("{count, plural, one {# subject} other {# subjects}}", {
      count: syllabus.kind === "notice" ? subjects : syllabus.subjects.length,
    });
  }

  return t("{count, plural, one {# module} other {# modules}}", {
    count: syllabus.subjects.length,
  });
}

/**
 * A subject's columns, as wide as the list allows: on a phone (a narrow list) its name over a bar
 * as wide as the row; from a tablet one line, the name, its bar and its share in columns every
 * row shares; where the list is wide enough, its questions on the exam before the bar.
 */
const ROW_GRID_CLASS = cn(
  "flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-2 py-3",
  "@lg/subjects:grid @lg/subjects:grid-cols-[minmax(0,1fr)_minmax(7rem,14rem)] @lg/subjects:items-center @lg/subjects:gap-x-3.5 @lg/subjects:py-0",
  "@2xl/subjects:grid-cols-[minmax(0,1fr)_6.5rem_minmax(8rem,14rem)]",
);

/**
 * What the rows' bars measure, beside the section's name: an exam's subjects read their
 * preparation, as the number above them does; another goal's modules, their lessons studied, known
 * and still new.
 */
function BarsMeaning({ syllabus }: { syllabus: SyllabusView }) {
  const t = useExtracted();

  if (syllabus.goal.kind !== "exam") {
    return <CoverageLegend />;
  }

  return (
    <span className="text-muted-foreground text-[0.71875rem]" data-slot="bars-meaning">
      {t("Preparation")}
    </span>
  );
}

/** The share at the row's end, in one width so the shares line up. */
const SHARE_CLASS = "w-10 justify-end";

/**
 * One subject on one row: its name as the notice writes it (whole in its tooltip where the line
 * cuts it), its questions on the exam where there's room, its bar and its share at the end (an
 * exam subject's preparation, a module's lessons studied or known). One the plan leaves out says
 * so where its bar would be, with its preparation at the end when the goal still counts it (the
 * exam tests it): the goal's number is its subjects together, and read beside fewer of them it
 * sat under every one.
 */
function SubjectRow({ href, subject }: { href: string; subject: SyllabusSubject }) {
  const t = useExtracted();
  const formatShare = useFormatProgressShare();
  const progress = useSubjectProgress()(subject);
  const notPlanned = subject.notPlannedReason !== null;
  const share = progress.bar ? getSubjectShare(progress.bar) : subject.preparation;

  return (
    <ListRowLink href={href}>
      <span className={ROW_GRID_CLASS}>
        <span
          className={cn(
            "text-sm leading-snug font-medium text-pretty @lg/subjects:truncate",
            notPlanned && "text-muted-foreground",
          )}
          title={subject.name}
        >
          {subject.name}
        </span>

        <span className="text-muted-foreground hidden text-right font-mono text-xs whitespace-nowrap tabular-nums @2xl/subjects:block">
          {subject.questions !== null &&
            subject.questions > 0 &&
            t("{count, plural, one {# question} other {# questions}}", {
              count: subject.questions,
            })}
        </span>

        {progress.bar ? (
          <CoverageBar {...progress.bar} />
        ) : (
          <span className="text-muted-foreground text-xs">{progress.label}</span>
        )}
      </span>

      <ListRowTrailing className={SHARE_CLASS}>
        {share !== null && formatShare(share)}
      </ListRowTrailing>
    </ListRowLink>
  );
}

function getGroupId(index: number): string {
  return `${SECTION_TITLE_ID}-group-${index}`;
}

/**
 * A group's name as a row of the list, between its hairlines: the notice's own group ("Basic
 * knowledge (P1)"), or "Beyond the notice" for the plan's own areas.
 */
function GroupHeading({
  document,
  fromMaterial,
  group,
  id,
}: {
  document: SyllabusView["examDocument"];
  fromMaterial: boolean;
  group: SubjectGroup;
  id: string;
}) {
  const name = useGroupName({ document, fromMaterial, group });

  if (!name) {
    return null;
  }

  return (
    <h3
      className="text-muted-foreground flex min-h-9 items-center pt-2 text-xs font-medium"
      id={id}
    >
      {name}
    </h3>
  );
}

/**
 * The structure of the goal on the Plan: an exam's subjects as its notice lists them (grouped as
 * it groups them, the plan's own extras last) or the plan's modules, one list of rows in columns
 * (see `SubjectRow`), each opening the subject's page with its topics and chapters. What the bars
 * measure sits beside the section's name; what the list counts and where its numbers come from go
 * in one note under it.
 */
export function SyllabusSection({
  subjectHref,
  syllabus,
}: {
  subjectHref: (key: string) => string;
  syllabus: SyllabusView;
}) {
  const title = useSectionTitle(syllabus);
  const count = useSectionCount(syllabus);
  const groups = groupSubjects(syllabus.subjects, { modules: syllabus.kind === "modules" });

  return (
    <PageSection
      aria-labelledby={SECTION_TITLE_ID}
      className="@container/subjects"
      data-slot="syllabus"
    >
      <PageSectionHeader>
        <PageSectionTitle id={SECTION_TITLE_ID}>{title}</PageSectionTitle>
        <BarsMeaning syllabus={syllabus} />
      </PageSectionHeader>

      <div className={LIST_GROUP_CLASS}>
        {groups.map((group, index) => (
          <Fragment key={group.extra ? "extra" : (group.name ?? "all")}>
            <GroupHeading
              document={syllabus.examDocument}
              fromMaterial={syllabus.fromMaterial}
              group={group}
              id={getGroupId(index)}
            />

            <ul aria-labelledby={group.extra || group.name ? getGroupId(index) : SECTION_TITLE_ID}>
              {group.subjects.map((subject) => (
                <li key={subject.key}>
                  <SubjectRow href={subjectHref(subject.key)} subject={subject} />
                </li>
              ))}
            </ul>
          </Fragment>
        ))}
      </div>

      <QuestionsSourceNote lead={count} source={syllabus.questionsSource} />
      <CourseWeightsNote subjects={syllabus.subjects} weights={syllabus.courseWeights} />
    </PageSection>
  );
}
