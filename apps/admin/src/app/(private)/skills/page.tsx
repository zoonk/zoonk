import { AdminPage, AdminPageBody, AdminPageHeader } from "@/components/admin-page";
import { type Metadata } from "next";
import { Suspense } from "react";
import { SkillFilters, SkillFiltersSkeleton } from "./skill-filters";
import { SkillList, SkillListSkeleton } from "./skill-list";

export const metadata: Metadata = { title: "Skills" };

export default function SkillsPage({ searchParams }: PageProps<"/skills">) {
  return (
    <AdminPage>
      <AdminPageHeader title="Skills" />

      <AdminPageBody>
        <Suspense fallback={<SkillFiltersSkeleton />}>
          <SkillFilters searchParams={searchParams} />
        </Suspense>

        <Suspense fallback={<SkillListSkeleton />}>
          <SkillList searchParams={searchParams} />
        </Suspense>
      </AdminPageBody>
    </AdminPage>
  );
}
