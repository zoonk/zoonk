import { getCurrentUserMemory } from "@zoonk/core/memory/get";
import { Page, PageHeader, PageHeaderContent, PageSubtitle, PageTitle } from "@zoonk/learn/page";
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
    <ProtectedSection allowGuests>{memory && <MemorySettings memory={memory} />}</ProtectedSection>
  );
}

function MemorySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-20 rounded-2xl" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-32 rounded-2xl" />
    </div>
  );
}

export default async function MemoryPage() {
  const t = await getExtracted();

  return (
    <Page>
      <PageHeader>
        <PageHeaderContent>
          <PageTitle>{t("Memory")}</PageTitle>
          <PageSubtitle>
            {t("What Zoonk remembers to give you examples and plans that fit your life.")}
          </PageSubtitle>
        </PageHeaderContent>
      </PageHeader>

      <Suspense fallback={<MemorySkeleton />}>
        <MemoryContent />
      </Suspense>
    </Page>
  );
}
