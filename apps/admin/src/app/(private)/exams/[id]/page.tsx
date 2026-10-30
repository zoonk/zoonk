import {
  AdminDetailBody,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSectionSkeleton } from "@/components/admin-section";
import { getExam } from "@/data/exams/get-exam";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FreshnessCommandForm } from "../../sources/freshness-command-form";
import { ExamEditionHistory } from "./exam-edition-history";
import { ExamOverview } from "./exam-overview";

export const metadata: Metadata = { title: "Exam" };

const EXAM_PARENTS = [{ href: "/exams", label: "Exams" }];

export default function ExamDetailPage({ params }: PageProps<"/exams/[id]">) {
  return (
    <AdminDetailPage>
      <Suspense fallback={<ExamDetailSkeleton />}>
        <ExamDetailContent params={params} />
      </Suspense>
    </AdminDetailPage>
  );
}

async function ExamDetailContent({ params }: Pick<PageProps<"/exams/[id]">, "params">) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const exam = await getExam(id);

  if (!exam) {
    notFound();
  }

  return (
    <>
      <AdminDetailHeader
        actions={<FreshnessCommandForm targetId={exam.id} targetKind="exam" />}
        facts={[exam.board, exam.role, exam.country, exam.language.toUpperCase()]}
        parents={EXAM_PARENTS}
        title={exam.name}
      />

      <AdminDetailBody>
        <ExamOverview exam={exam} />

        <Suspense fallback={<AdminSectionSkeleton description />}>
          <ExamEditionHistory examBlueprintId={exam.id} />
        </Suspense>
      </AdminDetailBody>
    </>
  );
}

function ExamDetailSkeleton() {
  return (
    <>
      <AdminDetailHeaderSkeleton actions="buttons" parents={EXAM_PARENTS} />

      <AdminDetailBody>
        <AdminSectionSkeleton rows={10} />
        <AdminSectionSkeleton />
      </AdminDetailBody>
    </>
  );
}
