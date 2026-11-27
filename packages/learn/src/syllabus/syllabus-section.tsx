"use client";

import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { hasSubjectPages } from "@zoonk/core/view-models/syllabus/subject-pages";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { CoverageBar, CoverageLegend } from "../_components/coverage-bar";
import {
  ListRowChevronSpace,
  ListRowDescription,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { QuietDisclosure } from "../_components/quiet-disclosure";
import { useFormatProgressShare } from "../_utils/percent";
import { useExamQuestionCount } from "../exam/use-exam-question-count";
import { namesModules } from "./names-modules";
import { SharedExamsNote, useAlsoIn } from "./shared-exams";
import { SubjectGroups } from "./subject-groups";
import { CourseWeightsNote, QuestionsSourceNote } from "./syllabus-notes";
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
  return namesModules(syllabus.goal.kind) ? t("Modules") : t("Subjects");
}

/** From this width a row shows its exam's question count in a column of its own. */
const QUESTIONS_COLUMNS_CLASS = "@2xl/subjects:grid-cols-[minmax(0,1fr)_6.5rem_minmax(8rem,14rem)]";

const ROW_GRID_CLASS = cn(
  // A bar has no leading under it, so a phone's stacked row ending in one keeps the room the name
  // has over its capitals.
  "flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-2 py-3 @max-lg/subjects:has-data-[slot=coverage-bar]:pb-4",
  "@lg/subjects:grid @lg/subjects:grid-cols-[minmax(0,1fr)_minmax(7rem,14rem)] @lg/subjects:items-center @lg/subjects:gap-x-3.5 @lg/subjects:py-2",
  QUESTIONS_COLUMNS_CLASS,
);

const SHARE_CLASS = "w-10 shrink-0 justify-end";

function BarsMeaning({ syllabus }: { syllabus: SyllabusSectionView }) {
  const t = useExtracted();

  if (syllabus.goal.kind !== "exam") {
    return <CoverageLegend />;
  }

  const counted = syllabus.subjects.some((subject) => (subject.questions ?? 0) > 0);

  // Laid out as the rows are, so each heading sits over its column: the questions' column where
  // rows show it, and the shares' column, which the word may overhang toward the bars.
  return (
    <span
      className="text-muted-foreground text-2xs flex min-w-0 flex-1 items-center justify-end gap-3"
      data-slot="bars-meaning"
    >
      {counted && (
        <span
          className={cn(
            "hidden min-w-0 flex-1 gap-x-3.5 @2xl/subjects:grid",
            QUESTIONS_COLUMNS_CLASS,
          )}
        >
          <span className="col-start-2 text-right">
            {t({
              description:
                'Heads the column of how many questions each subject has on the exam, like "45 questions".',
              message: "On the exam",
            })}
          </span>
        </span>
      )}
      <span className={cn(SHARE_CLASS, "flex whitespace-nowrap")}>{t("Preparation")}</span>
      <ListRowChevronSpace />
    </span>
  );
}

function SubjectRow({
  href,
  isModule,
  sharedExams,
  subject,
}: {
  href: string;
  isModule: boolean;
  sharedExams: SyllabusView["sharedExams"];
  subject: SyllabusSectionSubject;
}) {
  const formatShare = useFormatProgressShare();
  const questionCount = useExamQuestionCount();
  const progress = useSubjectProgress({ isModule })(subject);
  const alsoIn = useAlsoIn({ sharedExams, sharedWith: subject.sharedWith });
  const notPlanned = subject.notPlannedReason !== null;
  const share = progress.bar ? getSubjectShare(progress.bar) : subject.preparation;

  return (
    <ListRowLink href={href}>
      <span className={ROW_GRID_CLASS}>
        <span className="flex min-w-0 flex-col gap-0.5">
          <ListRowTitle className={cn("wrap-anywhere", notPlanned && "text-muted-foreground")}>
            {subject.shortName ?? subject.name}
          </ListRowTitle>

          {alsoIn && <ListRowDescription>{alsoIn}</ListRowDescription>}
        </span>

        <span className="text-muted-foreground hidden text-right font-mono text-xs whitespace-nowrap tabular-nums @2xl/subjects:block">
          {subject.questions !== null && subject.questions > 0 && questionCount(subject.questions)}
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

export function SyllabusSection({
  subjectHref,
  syllabus,
}: {
  subjectHref: (key: string) => string;
  syllabus: SyllabusSectionView;
}) {
  const t = useExtracted();
  const title = useSectionTitle(syllabus);
  const isModule = namesModules(syllabus.goal.kind);

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

      <SubjectGroups
        renderSubject={(subject) => (
          <SubjectRow
            href={subjectHref(subject.key)}
            isModule={isModule}
            sharedExams={syllabus.sharedExams}
            subject={subject}
          />
        )}
        syllabus={syllabus}
        titleId={SECTION_TITLE_ID}
      />

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
