import { AdminPage, AdminPageBody, AdminPageHeader } from "@/components/admin-page";
import { type Metadata } from "next";
import { Suspense } from "react";
import { ExamList, ExamListSkeleton } from "./exam-list";

export const metadata: Metadata = { title: "Exams" };

export default function ExamsPage({ searchParams }: PageProps<"/exams">) {
  return (
    <AdminPage>
      <AdminPageHeader title="Exams" />

      <AdminPageBody>
        <Suspense fallback={<ExamListSkeleton />}>
          <ExamList searchParams={searchParams} />
        </Suspense>
      </AdminPageBody>
    </AdminPage>
  );
}
