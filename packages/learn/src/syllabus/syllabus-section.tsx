"use client";

import { type SyllabusSubject, type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { hasSubjectPages } from "@zoonk/core/view-models/syllabus/subject-pages";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import {
  LIST_GROUP_CLASS,
  ListRowContent,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { Meter, MeterFill } from "../_components/meter";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionLabel,
  PageSectionTitle,
} from "../_components/page";
import { type SubjectGroup, groupSubjects } from "./group-subjects";
import { SubjectIcon } from "./subject-icon";
import { CourseWeightsNote, QuestionsSourceNote, useGroupName } from "./syllabus-notes";
import { useSubjectProgress } from "./use-subject-progress";

const SECTION_TITLE_ID = "journey-syllabus-title";

/**
 * Whether a goal's structure is worth its own section: when its subjects have pages of their own
 * (an exam's notice, or at least two modules).
 */
export function hasSyllabusSection(syllabus: SyllabusView | null): syllabus is SyllabusView {
  return syllabus !== null && hasSubjectPages({ goalKind: syllabus.goal.kind, syllabus });
}

/** "What's on the exam" for a notice, "Subjects" for an exam without one, "Modules" otherwise. */
function useSectionTitle(syllabus: SyllabusView): string {
  const t = useExtracted();

  if (syllabus.kind === "notice") {
    return t("What's on the exam");
  }

  return syllabus.goal.kind === "exam" ? t("Subjects") : t("Modules");
}

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
 * One subject: its icon, its name as the notice writes it, how far the learner is in it, and its
 * questions on the exam when they're known.
 */
function SubjectRow({ href, subject }: { href: string; subject: SyllabusSubject }) {
  const t = useExtracted();
  const progress = useSubjectProgress()(subject);
  const notPlanned = subject.notPlannedReason !== null;

  // A written test (an essay) has no questions to count.
  const questions =
    subject.questions !== null &&
    subject.questions > 0 &&
    t("{count, plural, one {# question} other {# questions}}", { count: subject.questions });

  return (
    <ListRowLink href={href}>
      <ListRowLeading>
        <SubjectIcon imageUrl={subject.imageUrl} />
      </ListRowLeading>

      <ListRowContent className="gap-1.5">
        <ListRowTitle className={cn("line-clamp-2", notPlanned && "text-muted-foreground")}>
          {subject.name}
        </ListRowTitle>

        <span className="flex items-center gap-2.5">
          {progress.share !== null && (
            <Meter className="h-1 max-w-28 flex-1">
              <MeterFill className="bg-success" share={progress.share} />
            </Meter>
          )}
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {progress.label}
          </span>
        </span>
      </ListRowContent>

      {questions && <ListRowTrailing className="text-xs">{questions}</ListRowTrailing>}
    </ListRowLink>
  );
}

function getGroupId(index: number): string {
  return `${SECTION_TITLE_ID}-group-${index}`;
}

function GroupHeading({
  fromMaterial,
  group,
  id,
}: {
  fromMaterial: boolean;
  group: SubjectGroup;
  id: string;
}) {
  const name = useGroupName({ fromMaterial, group });

  if (!name) {
    return null;
  }

  return <PageSectionLabel id={id}>{name}</PageSectionLabel>;
}

/**
 * The structure of the goal on the Journey: an exam's subjects as its notice lists them (grouped
 * as it groups them, the plan's own extras last) or the plan's modules, each a row with its icon,
 * name and progress, opening the subject's page with its topics and chapters.
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
    <PageSection aria-labelledby={SECTION_TITLE_ID} data-slot="syllabus">
      <PageSectionHeader>
        <PageSectionTitle id={SECTION_TITLE_ID}>{title}</PageSectionTitle>
        <PageSectionDetail>{count}</PageSectionDetail>
      </PageSectionHeader>

      {groups.map((group, index) => (
        <div className="flex flex-col gap-2" key={group.extra ? "extra" : (group.name ?? "all")}>
          <GroupHeading fromMaterial={syllabus.fromMaterial} group={group} id={getGroupId(index)} />

          <ul
            aria-labelledby={group.extra || group.name ? getGroupId(index) : SECTION_TITLE_ID}
            className={LIST_GROUP_CLASS}
          >
            {group.subjects.map((subject) => (
              <li key={subject.key}>
                <SubjectRow href={subjectHref(subject.key)} subject={subject} />
              </li>
            ))}
          </ul>
        </div>
      ))}

      <QuestionsSourceNote source={syllabus.questionsSource} />
      <CourseWeightsNote subjects={syllabus.subjects} weights={syllabus.courseWeights} />
    </PageSection>
  );
}
