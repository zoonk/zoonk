import { SectionPageHeader } from "@/components/learn/section-page";
import { Link } from "@/i18n/navigation";
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
    description: t("Choose when Zoonk reminds you to study, by email or push notification."),
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

function linkToPlan(children: React.ReactNode) {
  return (
    <Link className="underline underline-offset-3" href="/plan">
      {children}
    </Link>
  );
}

async function RemindersLine() {
  const t = await getExtracted();

  return t.rich("One reminder on your <plan>study days</plan>, if you're not done for the day.", {
    plan: linkToPlan,
  });
}

export default async function RemindersPage() {
  const t = await getExtracted();

  return (
    <Page className="max-w-form">
      <SectionPageHeader
        description={
          // One phrase: the subtitle lays its children out as separate facts.
          <span>
            <RemindersLine />
          </span>
        }
        title={t("Reminders")}
      />

      {/* A computer hides the line under a settings title, and this page reads wrong without it. */}
      <p className="text-muted-foreground hidden text-sm text-pretty md:block">
        <RemindersLine />
      </p>

      <Suspense fallback={<RemindersSkeleton />}>
        <RemindersContent />
      </Suspense>
    </Page>
  );
}
