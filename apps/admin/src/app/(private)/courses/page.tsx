import { AdminPage, AdminPageBody, AdminPageHeader, AdminToolbar } from "@/components/admin-page";
import { AdminSearch, AdminSearchSkeleton } from "@/components/admin-search";
import { type Metadata } from "next";
import { Suspense } from "react";
import { CourseList, CourseListSkeleton } from "./course-list";

export const metadata: Metadata = { title: "Courses" };

export default function CoursesPage({ searchParams }: PageProps<"/courses">) {
  return (
    <AdminPage>
      <AdminPageHeader title="Courses" />

      <AdminPageBody>
        <AdminToolbar>
          <Suspense fallback={<AdminSearchSkeleton />}>
            <AdminSearch placeholder="Search by title…" />
          </Suspense>
        </AdminToolbar>

        <Suspense fallback={<CourseListSkeleton />}>
          <CourseList searchParams={searchParams} />
        </Suspense>
      </AdminPageBody>
    </AdminPage>
  );
}
