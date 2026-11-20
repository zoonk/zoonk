import { AdminPage, AdminPageBody, AdminPageHeader } from "@/components/admin-page";
import { type Metadata } from "next";
import { Suspense } from "react";
import { SourceFilters, SourceFiltersSkeleton } from "./source-filters";
import { SourceList, SourceListSkeleton } from "./source-list";

export const metadata: Metadata = { title: "Sources" };

export default function SourcesPage({ searchParams }: PageProps<"/sources">) {
  return (
    <AdminPage>
      <AdminPageHeader title="Sources" />

      <AdminPageBody>
        <Suspense fallback={<SourceFiltersSkeleton />}>
          <SourceFilters searchParams={searchParams} />
        </Suspense>

        <Suspense fallback={<SourceListSkeleton />}>
          <SourceList searchParams={searchParams} />
        </Suspense>
      </AdminPageBody>
    </AdminPage>
  );
}
