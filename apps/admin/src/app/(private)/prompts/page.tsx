import { AdminPage, AdminPageBody, AdminPageHeader } from "@/components/admin-page";
import { type Metadata } from "next";
import { Suspense } from "react";
import { PromptFilters, PromptFiltersSkeleton } from "./prompt-filters";
import { PromptList, PromptListSkeleton } from "./prompt-list";

export const metadata: Metadata = { title: "Goal requests" };

export default function PromptsPage({ searchParams }: PageProps<"/prompts">) {
  return (
    <AdminPage>
      <AdminPageHeader title="Goal requests" />

      <AdminPageBody>
        <Suspense fallback={<PromptFiltersSkeleton />}>
          <PromptFilters searchParams={searchParams} />
        </Suspense>

        <Suspense fallback={<PromptListSkeleton />}>
          <PromptList searchParams={searchParams} />
        </Suspense>
      </AdminPageBody>
    </AdminPage>
  );
}
