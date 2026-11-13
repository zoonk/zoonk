import { ColumnScreen } from "@/components/public/column-screen";
import { getAppLocale } from "@/i18n/locale";
import { Link, getPathname } from "@/i18n/navigation";
import { hasSessionCookie } from "@zoonk/auth/cookies";
import { getSession } from "@zoonk/core/users/session";
import { Page, PageHeader, PageHeaderContent, PageSubtitle, PageTitle } from "@zoonk/learn/page";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { PendingLink } from "@zoonk/ui/patterns/links/pending";
import { LockIcon, LogInIcon, UserPlusIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { cookies } from "next/headers";

/** A browser that was logged out is told so on every page, since its plan is still there. */
export async function AuthGate({
  className,
  ended: knownEnded,
  heading: Heading = "h2",
  next,
}: {
  className?: string;
  ended?: boolean;
  heading?: "h1" | "h2";
  next: string;
}) {
  const t = await getExtracted();
  const session = await getSession();
  const locale = await getAppLocale();
  const ended = knownEnded ?? (!session && hasSessionCookie(await cookies()));
  const loginHref = `${getPathname({ href: "/login", locale })}?next=${encodeURIComponent(getPathname({ href: next, locale }))}`;

  if (session?.user.isAnonymous) {
    return (
      <Empty className={className} data-auth-gate>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LockIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>
            <Heading>{t("Create an account to use this page")}</Heading>
          </EmptyTitle>
          <EmptyDescription>{t("You keep your plan and progress.")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <PendingLink
            className={buttonVariants()}
            href={loginHref}
            icon={<UserPlusIcon aria-hidden="true" />}
          >
            {t("Create an account")}
          </PendingLink>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Empty className={className} data-auth-gate>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LockIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>
          <Heading>{ended ? t("You've been logged out") : t("Log in to continue")}</Heading>
        </EmptyTitle>
        {ended && <EmptyDescription>{t("Log in to get back to your plan.")}</EmptyDescription>}
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap gap-2">
          <PendingLink
            className={buttonVariants()}
            href={loginHref}
            icon={<LogInIcon aria-hidden="true" />}
          >
            {t("Log in")}
          </PendingLink>
          {!ended && (
            <Link className={buttonVariants({ variant: "outline" })} href="/start">
              {t("Start free")}
            </Link>
          )}
        </div>
      </EmptyContent>
    </Empty>
  );
}

export function AuthGateScreen({ next }: { next: string }) {
  return (
    <ColumnScreen>
      <AuthGate heading="h1" next={next} />
    </ColumnScreen>
  );
}

export function GatedPage({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <Page>
      <PageHeader>
        <PageHeaderContent>
          <PageTitle>{title}</PageTitle>
          <PageSubtitle>{description}</PageSubtitle>
        </PageHeaderContent>
      </PageHeader>

      {children}
    </Page>
  );
}

export function AuthGatePage({
  description,
  ended,
  next,
  title,
}: {
  description: string;
  ended?: boolean;
  next: string;
  title: string;
}) {
  return (
    <GatedPage description={description} title={title}>
      <AuthGate ended={ended} next={next} />
    </GatedPage>
  );
}
