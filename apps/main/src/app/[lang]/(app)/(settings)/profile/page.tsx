import { SectionPageHeader } from "@/components/learn/section-page";
import { getSession } from "@zoonk/core/users/session";
import { ListGroup } from "@zoonk/learn/list";
import { Page, PageSection, PageSectionHeader, PageSectionTitle } from "@zoonk/learn/page";
import { SettingRow } from "@zoonk/learn/setting-rows";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { ProtectedSection } from "../_components/protected-section";
import { DeleteAccountSection } from "./delete-account-section";
import { ExportDataButton } from "./export-data-button";
import { ProfileForm } from "./profile-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return { description: t("Your name, username and account on Zoonk."), title: t("Profile") };
}

const ACCOUNT_ID = "account";
const YOUR_DATA_ID = "your-data";

/** The account's name and username, its data and deleting it, each under its own label. */
async function ProfileContent() {
  const t = await getExtracted();
  const session = await getSession();

  return (
    <ProtectedSection next="/profile">
      <PageSection aria-labelledby={ACCOUNT_ID}>
        <PageSectionHeader>
          <PageSectionTitle id={ACCOUNT_ID}>{t("Account")}</PageSectionTitle>
        </PageSectionHeader>
        <ProfileForm
          defaultName={session?.user.name ?? ""}
          defaultUsername={session?.user.username ?? ""}
        />
      </PageSection>

      <PageSection aria-labelledby={YOUR_DATA_ID}>
        <PageSectionHeader>
          <PageSectionTitle id={YOUR_DATA_ID}>{t("Your data")}</PageSectionTitle>
        </PageSectionHeader>
        <ExportDataButton />
      </PageSection>

      <DeleteAccountSection userId={session?.user.id ?? ""} />
    </ProtectedSection>
  );
}

/** A section's own label over its rows while the account loads. */
function SectionSkeleton({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <PageSection>
      <PageSectionHeader>
        <PageSectionTitle>{label}</PageSectionTitle>
      </PageSectionHeader>
      {children}
    </PageSection>
  );
}

/**
 * The profile's three sections as they load, drawn with their own rows and words, the fields and
 * buttons as bars of their sizes, so nothing moves when the account arrives (the fields go under
 * their names on a phone).
 */
async function ProfileSkeleton() {
  const t = await getExtracted();

  return (
    <>
      <SectionSkeleton label={t("Account")}>
        <div className="flex flex-col">
          <ListGroup>
            <SettingRow description={t("How Zoonk and your buddy call you")} label={t("Name")} wide>
              <Skeleton className="h-11 w-full rounded-lg" />
            </SettingRow>
            <SettingRow
              description={t("3-30 characters. Letters, numbers, and underscores only.")}
              label={t("Username")}
              wide
            >
              <Skeleton className="h-11 w-full rounded-lg" />
            </SettingRow>
          </ListGroup>
          {/* Save, where the form keeps it: under a hairline, at the list's end. */}
          <div className="flex justify-end border-t pt-5">
            <Skeleton className="h-7.5 w-13 rounded-md" />
          </div>
        </div>
      </SectionSkeleton>

      <SectionSkeleton label={t("Your data")}>
        <ListGroup>
          <SettingRow
            description={t("Everything Zoonk keeps about you, as one file")}
            label={t("Download my data")}
          >
            <Skeleton className="h-7.5 w-25.5 rounded-md" />
          </SettingRow>
        </ListGroup>
      </SectionSkeleton>

      <SectionSkeleton label={t("Delete account")}>
        <ListGroup>
          <SettingRow
            description={t(
              "Deletes your account and everything in it for good. Plus bought on the web is canceled; App Store purchases are managed in the App Store.",
            )}
            label={t("Delete my account")}
          >
            <Skeleton className="h-7.5 w-17 rounded-md" />
          </SettingRow>
        </ListGroup>
      </SectionSkeleton>
    </>
  );
}

/**
 * The profile: the account's name and username as rows with their fields, the learner's data to
 * download, and deleting the account, each a row with its control at its end.
 */
export default async function ProfilePage() {
  const t = await getExtracted();

  return (
    <Page>
      <SectionPageHeader description={t("Your name, username and account.")} title={t("Profile")} />

      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileContent />
      </Suspense>
    </Page>
  );
}
