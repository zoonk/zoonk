import { SectionPageHeader } from "@/components/learn/section-page";
import { getLearningProfile } from "@zoonk/core/profile/get";
import { getSession } from "@zoonk/core/users/session";
import { ListGroup } from "@zoonk/learn/list";
import { Page, PageSection, PageSectionHeader, PageSectionTitle } from "@zoonk/learn/page";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getRequestCountry } from "@zoonk/utils/locale-request";
import {
  USAGE_DATA_COOKIE,
  getUsageDataChoice,
  parseUsageDataCookie,
  resolveUsageDataSharing,
} from "@zoonk/utils/usage-data";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { lang } from "next/root-params";
import { Suspense } from "react";
import { DeleteAccountRow } from "./delete-account-row";
import { DeletionPlusNotice } from "./deletion-plus-notice";
import { ExportDataRow } from "./export-data-row";
import { UsageDataRow } from "./usage-data-row";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t("Your usage data, a copy of your data, and deleting your account."),
    robots: { follow: false, index: false },
    title: t("Privacy"),
  };
}

const YOUR_DATA_ID = "your-data";

/** Off until the visitor says yes where the law needs one, as `AppAnalytics` decides. */
async function readShareUsageData(): Promise<boolean> {
  const language = await lang();

  const [cookieStore, requestHeaders, profile] = await Promise.all([
    cookies(),
    headers(),
    getLearningProfile(language),
  ]);

  const browser = parseUsageDataCookie(cookieStore.get(USAGE_DATA_COOKIE)?.value);

  const share = resolveUsageDataSharing({
    choice: getUsageDataChoice({ account: profile?.shareUsageData ?? null, browser }),
    country: getRequestCountry(requestHeaders),
  });

  return share ?? false;
}

/** A visitor's browser keeps their choice, so the switch is theirs too; the rows under it need an account. */
async function PrivacyContent() {
  const t = await getExtracted();
  const [session, share] = await Promise.all([getSession(), readShareUsageData()]);
  const account = session && !session.user.isAnonymous ? session.user : null;

  return (
    <>
      <ListGroup>
        <UsageDataRow share={share} />
      </ListGroup>

      {account && (
        <PageSection aria-labelledby={YOUR_DATA_ID}>
          <PageSectionHeader>
            <PageSectionTitle id={YOUR_DATA_ID}>{t("Your data")}</PageSectionTitle>
          </PageSectionHeader>
          <ListGroup>
            <ExportDataRow />
            <DeleteAccountRow
              plusNotice={
                <Suspense>
                  <DeletionPlusNotice />
                </Suspense>
              }
              userId={account.id}
            />
          </ListGroup>
        </PageSection>
      )}
    </>
  );
}

function PrivacySkeleton() {
  return <Skeleton className="h-15 rounded-lg" />;
}

export default async function PrivacyPage() {
  const t = await getExtracted();

  return (
    <Page measure="form">
      <SectionPageHeader title={t("Privacy")} />

      <Suspense fallback={<PrivacySkeleton />}>
        <PrivacyContent />
      </Suspense>
    </Page>
  );
}
