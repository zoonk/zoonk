import { AdminJson } from "@/components/admin-json";
import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { DetailField } from "@/components/detail-field";
import { ProvenanceFields } from "@/components/provenance";
import { getExam } from "@/data/exams/get-exam";
import { formatDateTime } from "@/lib/format";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FreshnessCommandForm } from "../../sources/freshness-command-form";
import { formatExamDate } from "../_utils/format-exam-date";
import { ReadNoticeAgainForm } from "./read-notice-again-form";
import { ResetExamSkillGraphForm } from "./reset-exam-skill-graph-form";

function countGraphSkills(graph: unknown): number {
  const skills =
    typeof graph === "object" && graph !== null && "skills" in graph ? graph.skills : [];

  return Array.isArray(skills) ? skills.length : 0;
}

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

      <AdminSection
        action={exam.source && <ReadNoticeAgainForm examBlueprintId={exam.id} />}
        description="Read from its notice once and reused whatever prompt version read it. Read again to redo it with today's instructions."
        title="Blueprint"
      >
        <div className="flex flex-col gap-3">
          <AdminJson label="Current edition" value={exam.edition} />
          <AdminJson label="Structure" value={exam.structure} />
          <AdminJson label="Topic frequency" value={exam.topicFrequency} />
        </div>
      </AdminSection>

      <AdminSection
        action={exam.skillGraph && <ResetExamSkillGraphForm examBlueprintId={exam.id} />}
        description="Every new learner of the exam plans from it, whatever prompt version wrote it. Reading the notice again also adds skills for topics none of its skills teaches (an option a new reading names); reset to have the next learner write a new one."
        title="Skill graph"
      >
        {exam.skillGraph ? (
          <dl className="divide-y">
            <DetailField label="Skills">{countGraphSkills(exam.skillGraph.graph)}</DetailField>
            <DetailField label="Generated">
              {formatDateTime(exam.skillGraph.generatedAt)}
            </DetailField>
            <DetailField label="Model">{exam.skillGraph.model}</DetailField>
            <DetailField label="Prompt version">
              <span className="font-mono text-xs">{exam.skillGraph.promptVersion}</span>
            </DetailField>
          </dl>
        ) : (
          <AdminSectionEmpty>
            No skill graph yet: the exam&apos;s next learner writes one.
          </AdminSectionEmpty>
        )}
      </AdminSection>

      <AdminSection title="Provenance">
        <ProvenanceFields provenance={exam} />
      </AdminSection>
    </div>
  );
}
