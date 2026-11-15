"use client";

import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { hasSubjectPages } from "@zoonk/core/view-models/syllabus/subject-pages";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { CoverageBar, CoverageLegend } from "../_components/coverage-bar";
import {
  LIST_GROUP_CLASS,
  ListRowChevronSpace,
  ListRowDescription,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import {
  PageSection,
  PageSectionFooter,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { QuietDisclosure } from "../_components/quiet-disclosure";
import { useFormatProgressShare } from "../_utils/percent";
import { type SubjectGroup, groupSubjects } from "./group-subjects";
import { SharedExamsNote, useAlsoIn } from "./shared-exams";
import { CourseWeightsNote, QuestionsSourceNote, useGroupName } from "./syllabus-notes";
import { type SyllabusSectionSubject, type SyllabusSectionView } from "./syllabus-section-view";
import { getSubjectShare, useSubjectProgress } from "./use-subject-progress";

const SECTION_TITLE_ID = "journey-syllabus-title";

export function hasSyllabusSection<Syllabus extends SyllabusSectionView>(
  syllabus: Syllabus | null,
): syllabus is Syllabus {
  return syllabus !== null && hasSubjectPages({ goalKind: syllabus.goal.kind, syllabus });
}

function useSectionTitle(syllabus: SyllabusSectionView): string {
  const t = useExtracted();
  return syllabus.goal.kind === "exam" ? t("Subjects") : t("Modules");
}

function useSectionCount(syllabus: SyllabusSectionView): string {
  const t = useExtracted();
  const subjects = syllabus.subjects.filter((subject) => subject.source === "notice").length;

  // The learner's material is never a notice: its topics (or headings) count as the reveal's do.
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

const ROW_GRID_CLASS = cn(
  // A bar has no leading under it, so a phone's stacked row ending in one keeps the room the name
  // has over its capitals.
  "flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-2 py-3 @max-lg/subjects:has-data-[slot=coverage-bar]:pb-4",
  "@lg/subjects:grid @lg/subjects:grid-cols-[minmax(0,1fr)_minmax(7rem,14rem)] @lg/subjects:items-center @lg/subjects:gap-x-3.5 @lg/subjects:py-2",
  "@2xl/subjects:grid-cols-[minmax(0,1fr)_6.5rem_minmax(8rem,14rem)]",
);

function BarsMeaning({ syllabus }: { syllabus: SyllabusSectionView }) {
  const t = useExtracted();

  if (syllabus.goal.kind !== "exam") {
    return <CoverageLegend />;
  }

  return (
    // Ends where the rows' values end: before the chevron's slot.
    <span className="flex items-center gap-3" data-slot="bars-meaning">
      <span className="text-muted-foreground text-2xs">{t("Preparation")}</span>
      <ListRowChevronSpace />
    </span>
  );
}

const SHARE_CLASS = "w-10 shrink-0 justify-end";

function SubjectRow({
  href,
  sharedExams,
  subject,
}: {
  href: string;
  sharedExams: SyllabusView["sharedExams"];
  subject: SyllabusSectionSubject;
}) {
  const t = useExtracted();
  const formatShare = useFormatProgressShare();
  const progress = useSubjectProgress()(subject);
  const alsoIn = useAlsoIn({ sharedExams, sharedWith: subject.sharedWith });
  const notPlanned = subject.notPlannedReason !== null;
  const share = progress.bar ? getSubjectShare(progress.bar) : subject.preparation;

  return (
    <ListRowLink href={href}>
      <span className={ROW_GRID_CLASS}>
        <span className="flex min-w-0 flex-col gap-0.5">
          <ListRowTitle className={cn("wrap-anywhere", notPlanned && "text-muted-foreground")}>
            {subject.name}
          </ListRowTitle>

          {alsoIn && <ListRowDescription className="text-pretty">{alsoIn}</ListRowDescription>}
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

function GroupHeading({ group, id }: { group: SubjectGroup<SyllabusSectionSubject>; id: string }) {
  const name = useGroupName(group);

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

export function SyllabusSection({
  subjectHref,
  syllabus,
}: {
  subjectHref: (key: string) => string;
  syllabus: SyllabusSectionView;
}) {
  const t = useExtracted();
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

      <SharedExamsNote sharedExams={syllabus.sharedExams} />

      <div className={LIST_GROUP_CLASS}>
        {groups.map((group, index) => (
          // A group's heading and its rows are one item of the list, so a rule sits above the
          // heading and none between it and its rows.
          <div key={group.extra ? "extra" : (group.name ?? "all")}>
            <GroupHeading group={group} id={getGroupId(index)} />

            <ul
              aria-labelledby={group.extra || group.name ? getGroupId(index) : SECTION_TITLE_ID}
              className="divided-rows"
            >
              {group.subjects.map((subject) => (
                <li key={subject.key}>
                  <SubjectRow
                    href={subjectHref(subject.key)}
                    sharedExams={syllabus.sharedExams}
                    subject={subject}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <PageSectionFooter>{count}</PageSectionFooter>

      {(syllabus.questionsSource || syllabus.courseWeights?.source) && (
        <QuietDisclosure label={t("Sources")}>
          <div className="flex flex-col gap-2 pt-2">
            <QuestionsSourceNote source={syllabus.questionsSource} />
            <CourseWeightsNote subjects={syllabus.subjects} weights={syllabus.courseWeights} />
          </div>
        </QuietDisclosure>
      )}
    </PageSection>
  );
}
