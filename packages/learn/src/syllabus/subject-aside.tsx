"use client";

import { type SyllabusSubject, type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { BigQuantity } from "@zoonk/ui/components/big-quantity";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { CoverageBar } from "../_components/coverage-bar";
import { DetailAsideSection, DetailProperties, DetailProperty } from "../_components/detail-page";
import { PAGE_SECTION_TITLE_CLASS } from "../_components/page";
import { useFormatProgressShare } from "../_utils/percent";
import { useExamQuestionsLabel } from "../exam/use-exam-question-count";
import { useFormatPlanDate } from "../plan/plan-date-text";

function getCoverage(subject: SyllabusSubject) {
  if (subject.lessonsTotal === 0) {
    return { known: 0, new: 1, studied: 0 };
  }

  const studied = Math.min(1, subject.lessonsDone / subject.lessonsTotal);
  const known = Math.min(1 - studied, subject.lessonsKnown / subject.lessonsTotal);

  return { known, new: Math.max(0, 1 - studied - known), studied };
}

function SubjectMastery({ mastery }: { mastery: SyllabusSubject["mastery"] }) {
  const t = useExtracted();

  if (!mastery) {
    return null;
  }

  return (
    <p className="text-2xs flex flex-col gap-0.5" data-slot="subject-mastery">
      <span className="font-medium">{t("Right answers")}</span>
      <span className="text-muted-foreground font-mono tabular-nums">
        {t("{done, number} of {total, number}", { done: mastery.correct, total: mastery.answered })}
      </span>
    </p>
  );
}

function SubjectPreparation({
  className,
  labelled,
  mastery,
  share,
}: {
  className?: string;
  labelled: boolean;
  mastery: SyllabusSubject["mastery"];
  share: number;
}) {
  const t = useExtracted();
  const formatShare = useFormatProgressShare();

  return (
    <div className={cn("flex flex-col gap-2", className)} data-slot="subject-preparation">
      {labelled && <span className={PAGE_SECTION_TITLE_CLASS}>{t("Preparation")}</span>}

      <BigQuantity className={labelled ? "text-2xl" : "text-3xl"}>{formatShare(share)}</BigQuantity>
      <CoverageBar studied={share} />

      <SubjectMastery mastery={mastery} />
    </div>
  );
}

/**
 * An exam subject out of the plan keeps its preparation, since the exam still tests it; any other
 * subject out of it has nothing.
 */
export function SubjectCoverage({
  className,
  labelled = false,
  subject,
}: {
  className?: string;
  labelled?: boolean;
  subject: SyllabusSubject;
}) {
  const t = useExtracted();
  const formatShare = useFormatProgressShare();
  const coverage = getCoverage(subject);

  if (subject.preparation !== null) {
    return (
      <SubjectPreparation
        className={className}
        labelled={labelled}
        mastery={subject.mastery}
        share={subject.preparation}
      />
    );
  }

  if (subject.notPlannedReason) {
    return null;
  }

  const parts = [
    { dot: "bg-success", label: t("Studied"), share: coverage.studied },
    { dot: "bg-muted-foreground/70", label: t("Already knew"), share: coverage.known },
    { dot: "ring-muted-foreground/70 ring-1 ring-inset", label: t("New"), share: coverage.new },
  ];

  return (
    <div className={cn("flex flex-col gap-2", className)} data-slot="subject-coverage">
      <CoverageBar known={coverage.known} studied={coverage.studied} />
      <ul className="text-muted-foreground text-2xs flex flex-wrap items-center gap-x-3 gap-y-1">
        {parts.map((part) => (
          <li className="flex items-center gap-1.5" key={part.label}>
            <span aria-hidden="true" className={cn("size-1.5 rounded-full", part.dot)} />
            {part.label}
            <span className="text-foreground font-mono tabular-nums">
              {formatShare(part.share)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SubjectDetails({
  questionsSource,
  subject,
}: {
  questionsSource: SyllabusView["questionsSource"];
  subject: SyllabusSubject;
}) {
  const t = useExtracted();
  const formatPlanDate = useFormatPlanDate();
  const format = useFormatter();
  const edition = questionsSource?.edition;
  const questionsLabel = useExamQuestionsLabel();

  return (
    <DetailProperties>
      {subject.questions ? (
        <DetailProperty
          label={
            edition
              ? t({
                  description:
                    "Labels a subject's count of questions from a past exam. The exam's name and year go last, after the separator, with no article before them.",
                  id: "questionsNamedExamEdition",
                  message: "Questions · {exam}",
                  values: { exam: edition },
                })
              : questionsLabel
          }
          mono
        >
          {format.number(subject.questions)}
        </DetailProperty>
      ) : null}

      {subject.nextDate && (
        <DetailProperty label={t("Next date")} mono>
          {formatPlanDate(subject.nextDate)}
        </DetailProperty>
      )}

      {subject.lessonsKnown > 0 && (
        <DetailProperty label={t("Skipped")}>
          {t("{count, plural, one {# lesson} other {# lessons}}", { count: subject.lessonsKnown })}
        </DetailProperty>
      )}
    </DetailProperties>
  );
}

export function SubjectAside({
  questionsSource,
  subject,
  written,
}: {
  questionsSource: SyllabusView["questionsSource"];
  subject: SyllabusSubject;
  /** A written part shows its estimated points instead of its lessons' preparation. */
  written: boolean;
}) {
  const t = useExtracted();

  return (
    <>
      {!written && (!subject.notPlannedReason || subject.preparation !== null) && (
        <DetailAsideSection
          className="hidden min-[72rem]:flex"
          title={subject.preparation === null ? t("Coverage") : t("Preparation")}
          titleId="subject-coverage-title"
        >
          <SubjectCoverage subject={subject} />
        </DetailAsideSection>
      )}

      <DetailAsideSection
        className="hidden min-[72rem]:flex"
        title={t("Details")}
        titleId="subject-details-title"
      >
        <SubjectDetails questionsSource={questionsSource} subject={subject} />
      </DetailAsideSection>
    </>
  );
}
