import { AdminSection } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { ProvenanceFields } from "@/components/provenance";
import { STAT_TILES_CLASS, StatTile } from "@/components/stat-tile";
import { StateMark } from "@/components/state-mark";
import { type AdminExam } from "@/data/exams/get-exam";
import { countryName } from "@/lib/country-name";
import { formatCount, formatDate, formatDateTime } from "@/lib/format";
import { languageName } from "@/lib/language-filter";
import { examEditionSchema } from "@zoonk/core/library/exams/blueprint-contract";
import { parsePlanGraph } from "@zoonk/core/plans/plan-state";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { BrainCircuitIcon, CalendarIcon, ListChecksIcon, TargetIcon } from "lucide-react";
import Link from "next/link";
import { formatExamDate } from "../_utils/format-exam-date";

const LINK_CLASS = "hit-area relative underline underline-offset-3";

/** How far the exam's day is from today, in whole calendar days. */
function daysAway(examDate: Date): string {
  const days = Math.round((examDate.getTime() - toUTCMidnight(new Date()).getTime()) / MS_PER_DAY);

  if (days === 0) {
    return "Today";
  }

  return days > 0 ? `In ${formatCount(days, "day")}` : `${formatCount(-days, "day")} ago`;
}

/** Who depends on the exam and when it is: the four numbers staff open it for. */
export function ExamTotals({ exam }: { exam: AdminExam }) {
  const skills = exam.skillGraph ? parsePlanGraph(exam.skillGraph.graph).skills.length : 0;

  return (
    <div className={STAT_TILES_CLASS}>
      <StatTile
        detail="Learners studying for it"
        icon={<TargetIcon />}
        title="Goals"
        value={exam._count.goals.toLocaleString("en")}
      />

      <StatTile
        detail="Written for this exam"
        icon={<ListChecksIcon />}
        title="Practice questions"
        value={exam._count.items.toLocaleString("en")}
      />

      <StatTile
        detail={exam.skillGraph ? "In its skill graph" : "No skill graph yet"}
        href={exam.skillGraph ? `/exams/${exam.id}?tab=graph` : undefined}
        icon={<BrainCircuitIcon />}
        title="Skills"
        value={skills.toLocaleString("en")}
      />

      <StatTile
        detail={exam.examDate ? daysAway(exam.examDate) : "The notice gives no date"}
        icon={<CalendarIcon />}
        title="Exam date"
        value={
          exam.examDate
            ? exam.examDate.toLocaleDateString("en", {
                day: "numeric",
                month: "short",
                timeZone: "UTC",
              })
            : "None"
        }
      />
    </div>
  );
}

/** The dates the notice gives, in its own words; the two stored dates when it lists none. */
export function ExamEditionDates({ exam }: { exam: AdminExam }) {
  const edition = examEditionSchema.safeParse(exam.edition).data;
  const dates = edition?.dates ?? [];

  return (
    <AdminSection title={edition?.year ? `The ${edition.year} edition` : "This edition"}>
      <DetailFields>
        {dates.length > 0 ? (
          dates.map((date) => (
            <DetailField
              key={`${date.kind}-${date.date}-${date.label}`}
              label={date.label}
              mono={false}
            >
              {formatExamDate(new Date(date.date))}
              {date.startTime ? `, ${date.startTime}` : null}
            </DetailField>
          ))
        ) : (
          <>
            <DetailField label="Exam date" mono={false}>
              {formatExamDate(exam.examDate)}
            </DetailField>
            <DetailField label="Registration ends" mono={false}>
              {formatExamDate(exam.registrationEndsAt)}
            </DetailField>
          </>
        )}
      </DetailFields>
    </AdminSection>
  );
}

export function ExamChecking({ exam }: { exam: AdminExam }) {
  return (
    <AdminSection title="Checking for changes">
      <DetailFields>
        <DetailField label="Official notice">
          {exam.source ? (
            <Link className={LINK_CLASS} href={`/sources/${exam.source.id}`} prefetch>
              {exam.source.title ?? "Private upload"}
            </Link>
          ) : null}
        </DetailField>
        <DetailField label="Next check" mono={false}>
          {exam.nextCheckAt ? (
            formatDate(exam.nextCheckAt)
          ) : (
            <StateMark state="paused">Not being checked</StateMark>
          )}
        </DetailField>
      </DetailFields>
    </AdminSection>
  );
}

export function ExamDetails({ exam }: { exam: AdminExam }) {
  return (
    <AdminSection title="Details">
      <DetailFields>
        <DetailField label="Identity key">{exam.identityKey}</DetailField>
        <DetailField label="Board">{exam.board}</DetailField>
        <DetailField label="Role">{exam.role}</DetailField>
        <DetailField label="Country">{countryName(exam.country)}</DetailField>
        <DetailField label="Language">{languageName(exam.language)}</DetailField>
        <DetailField label="Good until" mono={false}>
          {exam.validUntil ? formatDateTime(exam.validUntil) : null}
        </DetailField>
        <DetailField label="Created" mono={false}>
          {formatDateTime(exam.createdAt)}
        </DetailField>
        <DetailField label="Updated" mono={false}>
          {formatDateTime(exam.updatedAt)}
        </DetailField>
      </DetailFields>
    </AdminSection>
  );
}

export function ExamWrittenBy({ exam }: { exam: AdminExam }) {
  return (
    <>
      <AdminSection title="Blueprint written by">
        <ProvenanceFields provenance={exam} />
      </AdminSection>

      {exam.skillGraph ? (
        <AdminSection title="Skill graph written by">
          <ProvenanceFields provenance={exam.skillGraph} />
        </AdminSection>
      ) : null}
    </>
  );
}
