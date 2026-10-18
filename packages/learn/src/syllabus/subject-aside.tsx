"use client";

import { type SyllabusSubject, type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { CoverageBar } from "../_components/coverage-bar";
import { DetailAsideSection, DetailProperties, DetailProperty } from "../_components/detail-page";
import { KindDot } from "../_components/kind-tile";
import {
  ListGroup,
  ListRowContent,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
} from "../_components/list-group";
import { useFormatProgressShare } from "../_utils/percent";
import { useFormatPlanDate } from "../plan/plan-date-text";

/** What the subject's lessons are: studied, skipped because the learner knows them, still new. */
function getCoverage(subject: SyllabusSubject) {
  if (subject.lessonsTotal === 0) {
    return { known: 0, new: 1, studied: 0 };
  }

  const studied = Math.min(1, subject.lessonsDone / subject.lessonsTotal);
  const known = Math.min(1 - studied, subject.lessonsKnown / subject.lessonsTotal);

  return { known, new: Math.max(0, 1 - studied - known), studied };
}

/**
 * How much practice backs an exam subject's preparation, as the Plan's sheet says it for the
 * goal: "Mastery 6 of 8 right", or that it shows after a few practice questions while the subject
 * has too few answers to count it, which is why a subject studied whole can still read low.
 */
function SubjectMastery({ mastery }: { mastery: SyllabusSubject["mastery"] }) {
  const t = useExtracted();

  return (
    <p className="flex flex-col gap-0.5 text-[0.71875rem]" data-slot="subject-mastery">
      <span className="font-medium">{t("Mastery")}</span>
      <span className="text-muted-foreground tabular-nums">
        {mastery
          ? t("{correct, number} of {answered, number} right", mastery)
          : t("Shows after a few practice questions")}
      </span>
    </p>
  );
}

/**
 * An exam subject's preparation: the bar and the share the Plan's row has for it, named where no
 * section title above it does (under the subject's facts, below 72rem), and how much practice
 * backs it.
 */
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
      {labelled && <span className="text-label">{t("Preparation")}</span>}

      <span className="flex items-center gap-3">
        <CoverageBar className="h-1.5 flex-1" studied={share} />
        <span className="font-mono text-sm tabular-nums">{formatShare(share)}</span>
      </span>

      <SubjectMastery mastery={mastery} />
    </div>
  );
}

/**
 * How far the learner is in the subject, the bar the Plan draws for it: an exam subject's
 * preparation with its share, or a module's lessons with each state's share under it: "Studied
 * 14% · Known 6% · New 80%". An exam subject out of the plan keeps its preparation while the goal
 * counts it (the exam tests it), as its Plan row does; any other subject out of it has nothing.
 */
export function SubjectCoverage({
  className,
  labelled = false,
  subject,
}: {
  className?: string;
  /** Names the measure, where no section title above the bar does. */
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
    { dot: "bg-muted-foreground/70", label: t("Known"), share: coverage.known },
    { dot: "ring-muted-foreground/70 ring-1 ring-inset", label: t("New"), share: coverage.new },
  ];

  return (
    <div className={cn("flex flex-col gap-2", className)} data-slot="subject-coverage">
      <CoverageBar className="h-1.5" known={coverage.known} studied={coverage.studied} />
      <ul className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.71875rem]">
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

/** "45 · Enem 2025": the subject's questions on the exam, and the edition they were counted in. */
function useQuestionsValue({
  source,
  subject,
}: {
  source: SyllabusView["questionsSource"];
  subject: SyllabusSubject;
}): string | null {
  if (!subject.questions) {
    return null;
  }

  return source?.edition ? `${subject.questions} · ${source.edition}` : String(subject.questions);
}

/** The subject's facts as properties: its questions, topics and chapters, and when it's next. */
function SubjectDetails({
  questionsSource,
  subject,
}: {
  questionsSource: SyllabusView["questionsSource"];
  subject: SyllabusSubject;
}) {
  const t = useExtracted();
  const formatPlanDate = useFormatPlanDate();
  const questions = useQuestionsValue({ source: questionsSource, subject });
  const chaptersDone = subject.chapters.filter((chapter) => chapter.state === "done").length;

  return (
    <DetailProperties>
      {questions && (
        <DetailProperty label={t("Questions")} mono>
          {questions}
        </DetailProperty>
      )}

      {subject.topics.length > 0 && (
        <DetailProperty label={t("Topics")} mono>
          {t("{done, number} of {total, number}", {
            done: subject.topicsStudied ?? 0,
            total: subject.topics.length,
          })}
        </DetailProperty>
      )}

      {subject.chapters.length > 0 && (
        <DetailProperty label={t("Chapters")} mono>
          {t("{done, number} of {total, number}", {
            done: chaptersDone,
            total: subject.chapters.length,
          })}
        </DetailProperty>
      )}

      {subject.nextDate && (
        <DetailProperty label={t("Next date")} mono>
          {formatPlanDate(subject.nextDate)}
        </DetailProperty>
      )}

      {subject.lessonsKnown > 0 && (
        <DetailProperty label={t("Known before")}>
          {t("{count, plural, one {# lesson skipped} other {# lessons skipped}}", {
            count: subject.lessonsKnown,
          })}
        </DetailProperty>
      )}
    </DetailProperties>
  );
}

/**
 * The subject's aside: how far the learner is in it (an exam subject's preparation, a module's
 * coverage) and its facts as properties (from 72rem; on smaller screens that bar sits under its
 * facts and the facts line says the rest), then its mind maps and asking the buddy about it
 * (`ask`, from 72rem; on smaller screens "Ask" is in the page's bar).
 */
export function SubjectAside({
  ask,
  mindMapsHref,
  questionsSource,
  subject,
}: {
  ask?: React.ReactNode;
  mindMapsHref: string | null;
  questionsSource: SyllabusView["questionsSource"];
  subject: SyllabusSubject;
}) {
  const t = useExtracted();

  return (
    <>
      {(!subject.notPlannedReason || subject.preparation !== null) && (
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

      {(mindMapsHref || ask) && (
        <DetailAsideSection
          className={cn(!mindMapsHref && "hidden min-[72rem]:flex")}
          title={t("Also")}
          titleId="subject-also-title"
        >
          <ListGroup>
            {mindMapsHref && (
              <ListRowLink href={mindMapsHref}>
                <ListRowLeading>
                  <KindDot kind="mindMap" />
                </ListRowLeading>
                <ListRowContent>
                  <ListRowTitle>{t("Mind maps")}</ListRowTitle>
                </ListRowContent>
              </ListRowLink>
            )}
            {ask && <div className="hidden min-[72rem]:block">{ask}</div>}
          </ListGroup>
        </DetailAsideSection>
      )}
    </>
  );
}
