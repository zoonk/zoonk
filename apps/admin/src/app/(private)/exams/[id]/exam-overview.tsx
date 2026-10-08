import { AdminJson } from "@/components/admin-json";
import { AdminSection } from "@/components/admin-section";
import { DetailField } from "@/components/detail-field";
import { ProvenanceFields } from "@/components/provenance";
import { getExam } from "@/data/exams/get-exam";
import { formatDateTime } from "@/lib/format";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FreshnessCommandForm } from "../../sources/freshness-command-form";
import { formatExamDate } from "../_utils/format-exam-date";

/** The blueprint's key facts, what was read from its documents and its freshness controls. */
export async function ExamOverview({ examBlueprintId }: { examBlueprintId: string }) {
  "use cache: private";

  const exam = await getExam(examBlueprintId);

  if (!exam) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{exam.name}</h2>
        <p className="text-muted-foreground text-sm">
          {[exam.board, exam.role, exam.country].filter(Boolean).join(" · ")}
        </p>
      </div>

      <AdminSection
        action={<FreshnessCommandForm targetId={exam.id} targetKind="exam" />}
        title="Exam"
      >
        <dl className="divide-y">
          <DetailField label="Identity key">
            <span className="font-mono text-xs">{exam.identityKey}</span>
          </DetailField>
          <DetailField label="Language">
            <span className="uppercase">{exam.language}</span>
          </DetailField>
          <DetailField label="Exam date">{formatExamDate(exam.examDate)}</DetailField>
          <DetailField label="Registration ends">
            {formatExamDate(exam.registrationEndsAt)}
          </DetailField>
          <DetailField label="Valid until">{formatDateTime(exam.validUntil)}</DetailField>
          <DetailField label="Next check">{formatDateTime(exam.nextCheckAt)}</DetailField>
          <DetailField label="Source">
            {exam.source ? (
              <Link className="hover:underline" href={`/sources/${exam.source.id}`} prefetch>
                {exam.source.title ?? "Private upload"}
              </Link>
            ) : (
              "—"
            )}
          </DetailField>
          <DetailField label="Goals">{exam._count.goals}</DetailField>
          <DetailField label="Items">{exam._count.items}</DetailField>
          <DetailField label="Created">{formatDateTime(exam.createdAt)}</DetailField>
          <DetailField label="Updated">{formatDateTime(exam.updatedAt)}</DetailField>
        </dl>
      </AdminSection>

      <AdminSection title="Blueprint">
        <div className="flex flex-col gap-3">
          <AdminJson label="Current edition" value={exam.edition} />
          <AdminJson label="Structure" value={exam.structure} />
          <AdminJson label="Topic frequency" value={exam.topicFrequency} />
        </div>
      </AdminSection>

      <AdminSection title="Provenance">
        <ProvenanceFields provenance={exam} />
      </AdminSection>
    </div>
  );
}
