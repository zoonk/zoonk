import { getSession } from "@zoonk/core/users/session";
import { PageSection, PageSectionHeader, PageSectionTitle } from "@zoonk/learn/page";
import { getExtracted } from "next-intl/server";

const ACCOUNT_ID = "settings-aside-account";

async function Account({ email }: { email: string }) {
  const t = await getExtracted();

  return (
    <PageSection aria-labelledby={ACCOUNT_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={ACCOUNT_ID}>{t("Your account")}</PageSectionTitle>
      </PageSectionHeader>

      <p className="text-sm wrap-break-word">{email}</p>
    </PageSection>
  );
}

export async function SettingsAside() {
  const session = await getSession();

  return session && !session.user.isAnonymous && <Account email={session.user.email} />;
}
