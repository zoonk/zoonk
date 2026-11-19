import { getCurrentPlusSubscription } from "@/data/subscriptions/get-current-plus-subscription";
import { getSession } from "@zoonk/core/users/session";
import { PageSection, PageSectionHeader, PageSectionTitle } from "@zoonk/learn/page";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";

const ACCOUNT_ID = "settings-aside-account";

/** A guest has a plan and no email yet. */
async function Account({ email }: { email: string | null }) {
  const t = await getExtracted();
  const subscription = await getCurrentPlusSubscription();

  return (
    <PageSection aria-labelledby={ACCOUNT_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={ACCOUNT_ID}>{t("Your account")}</PageSectionTitle>
      </PageSectionHeader>

      <div className="[&>*+*]:border-border flex flex-col text-sm [&>*+*]:border-t">
        {email && <p className="pb-2.5 wrap-break-word">{email}</p>}
        <dl className="flex items-baseline justify-between gap-3 py-2.5">
          <dt className="text-muted-foreground text-compact">{t("Plan")}</dt>
          <dd>{subscription ? t("Plus") : t("Free")}</dd>
        </dl>
      </div>
    </PageSection>
  );
}

/**
 * Beside every settings page from 72rem, for whoever has a session, a guest included: the frame
 * knows that before the first paint, so the column never changes width once the session is read.
 */
export async function SettingsAside() {
  const session = await getSession();

  return session && <Account email={session.user.isAnonymous ? null : session.user.email} />;
}

export function SettingsAsideSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-full" />
    </div>
  );
}
