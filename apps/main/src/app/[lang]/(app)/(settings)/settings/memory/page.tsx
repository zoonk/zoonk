import { SectionPageHeader } from "@/components/learn/section-page";
import { getCurrentUserMemory } from "@zoonk/core/memory/get";
import { Page } from "@zoonk/learn/page";
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

/** The memory switch's row, then a group of facts under its label. */
function MemorySkeleton() {
  return (
    <div className="flex flex-col gap-7">
      <Skeleton className="h-15 rounded-lg" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    </div>
  );
}

export default async function MemoryPage() {
  const t = await getExtracted();

  return (
    <Page>
      <SectionPageHeader title={t("Memory")} />

      {/* What memory is for, at every size: the switch and the facts follow from it. */}
      <p className="text-muted-foreground -mt-4 text-sm text-pretty md:mt-0">
        {t("What Zoonk remembers to give you examples and plans that fit your life.")}
      </p>

      <Suspense fallback={<MemorySkeleton />}>
        <MemoryContent />
      </Suspense>
    </Page>
  );
}
