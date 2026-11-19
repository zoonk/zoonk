import { SectionPageHeader } from "@/components/learn/section-page";
import { getCurrentUserMemory } from "@zoonk/core/memory/get";
import { Page } from "@zoonk/learn/page";
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

export default async function MemoryPage() {
  const t = await getExtracted();

  return (
    <Page>
      <SectionPageHeader
        description={t("What Zoonk remembers to give you examples and plans that fit your life.")}
        title={t("Memory")}
      />

      {/* Nothing stands in for the rows: what is remembered decides how wide they run. */}
      <Suspense fallback={null}>
        <MemoryContent />
      </Suspense>
    </Page>
  );
}
