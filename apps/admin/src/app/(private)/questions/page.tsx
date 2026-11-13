import { AdminPage, AdminPageBody, AdminPageHeader, AdminToolbar } from "@/components/admin-page";
import { AdminSearch, AdminSearchSkeleton } from "@/components/admin-search";
import { type Metadata } from "next";
import { Suspense } from "react";
import { QuestionList, QuestionListSkeleton } from "./question-list";

export const metadata: Metadata = { title: "Buddy questions" };

export default function QuestionsPage({ searchParams }: PageProps<"/questions">) {
  return (
    <AdminPage>
      <AdminPageHeader title="Buddy questions" />

      <AdminPageBody>
        <AdminToolbar>
          <Suspense fallback={<AdminSearchSkeleton />}>
            <AdminSearch placeholder="Search questions, answers, lessons, courses, or users…" />
          </Suspense>
        </AdminToolbar>

        <Suspense fallback={<QuestionListSkeleton />}>
          <QuestionList searchParams={searchParams} />
        </Suspense>
      </AdminPageBody>
    </AdminPage>
  );
}
