import { SectionPageHeader } from "@/components/learn/section-page";
import { getCurrentUserMemory } from "@zoonk/core/memory/get";
import { Page } from "@zoonk/learn/page";
import { PageAsideNote } from "@zoonk/learn/side-detail";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { ProtectedSection } from "../../_components/protected-section";
import { MemorySettings } from "./memory-settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t("See, correct or delete what Zoonk remembers about you."),
    robots: { follow: false, index: false },
    title: t("Memory"),
  };
}

async function MemoryContent() {
  const memory = await getCurrentUserMemory();

  return (
    <ProtectedSection allowGuests next="/settings/memory">
      {memory && <MemorySettings memory={memory} />}
    </ProtectedSection>
  );
}

/** The copy's block holds its place beside the rows, so they don't narrow as the memory arrives. */
function MemorySkeleton() {
  return (
    <div className="flex flex-col gap-7">
      <Skeleton className="h-15 rounded-lg" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
      <PageAsideNote className="flex flex-col gap-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="max-w-column h-10 w-full" />
      </PageAsideNote>
    </div>
  );
}

export default async function MemoryPage() {
  const t = await getExtracted();

  return (
    <Page>
      <SectionPageHeader
        description={t("What Zoonk remembers to give you examples and plans that fit your life.")}
        title={t("Memory")}
      />

      <Suspense fallback={<MemorySkeleton />}>
        <MemoryContent />
      </Suspense>
    </Page>
  );
}
