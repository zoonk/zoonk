import { SectionPageHeader } from "@/components/learn/section-page";
import { getStudyReminder } from "@zoonk/core/reminders/get";
import { Page } from "@zoonk/learn/page";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { ProtectedSection } from "../../_components/protected-section";
import { RemindersSettings } from "./reminders-settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t("Choose when Zoonk reminds you to study, by email or on your phone."),
    robots: { follow: false, index: false },
    title: t("Reminders"),
  };
}

async function RemindersContent() {
  const reminder = await getStudyReminder();

  return (
    <ProtectedSection allowGuests next="/settings/reminders">
      {reminder && <RemindersSettings reminder={reminder} />}
    </ProtectedSection>
  );
}

function RemindersSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-30 rounded-lg" />
      <Skeleton className="h-4 w-60" />
    </div>
  );
}

export default async function RemindersPage() {
  const t = await getExtracted();

  return (
    <Page className="max-w-form">
      <SectionPageHeader title={t("Reminders")} />

      <Suspense fallback={<RemindersSkeleton />}>
        <RemindersContent />
      </Suspense>
    </Page>
  );
}
