import { AdminPage, AdminPageBody, AdminPageHeader, AdminToolbar } from "@/components/admin-page";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { Suspense } from "react";
import { ContentFixList, ContentFixListSkeleton, ContentFixViews } from "./content-fix-list";

export const metadata: Metadata = { title: "Content fixes" };

export default function ContentFixesPage({ searchParams }: PageProps<"/content-fixes">) {
  return (
    <AdminPage>
      <AdminPageHeader title="Content fixes" />

      <AdminPageBody>
        <AdminToolbar>
          <Suspense fallback={<Skeleton className="h-7.5 w-44" />}>
            <ContentFixViews searchParams={searchParams} />
          </Suspense>
        </AdminToolbar>

        <Suspense fallback={<ContentFixListSkeleton />}>
          <ContentFixList searchParams={searchParams} />
        </Suspense>
      </AdminPageBody>
    </AdminPage>
  );
}
