import { AuthGateAction } from "@/components/auth-gate-action";
import { ColumnScreen } from "@/components/public/column-screen";
import { getAppLocale } from "@/i18n/locale";
import { Link, getPathname } from "@/i18n/navigation";
import { hasSessionCookie } from "@zoonk/auth/cookies";
import { getSession } from "@zoonk/core/users/session";
import { Page, PageHeader, PageHeaderContent, PageSubtitle, PageTitle } from "@zoonk/learn/page";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { cn } from "@zoonk/ui/lib/utils";
import { LockIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { cookies } from "next/headers";

/**
 * A page that needs an account. Inside another page the gate holds its own button; as the whole
 * screen (`bar`) its one way in is the bottom bar's main action, and the visitor's other way
 * ("Build my plan") stays in the page.
 */
export async function AuthGate({
  bar,
  className,
  ended: knownEnded,
  heading: Heading = "h2",
  next,
}: {
  bar?: boolean;
  className?: string;
  ended?: boolean;
  heading?: "h1" | "h2";
  next: string;
}) {
  const t = await getExtracted();
  const session = await getSession();
  const ended = knownEnded ?? (!session && hasSessionCookie(await cookies()));
  const loginHref = `/login?next=${encodeURIComponent(getPathname({ href: next, locale: await getAppLocale() }))}`;
  const guest = Boolean(session?.user.isAnonymous);

  const main = (
    <AuthGateAction href={loginHref}>{guest ? t("Create an account") : t("Log in")}</AuthGateAction>
  );

  const startLink = !guest && !ended && (
    <Link className={buttonVariants({ size: "lg", variant: "outline" })} href="/start">
      {t("Build my plan")}
    </Link>
  );

  const words = guest ? (
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <LockIcon aria-hidden="true" />
      </EmptyMedia>
      <EmptyTitle>
        <Heading>{t("Create an account to use this page")}</Heading>
      </EmptyTitle>
      <EmptyDescription>{t("You keep your plan and progress.")}</EmptyDescription>
    </EmptyHeader>
  ) : (
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <LockIcon aria-hidden="true" />
      </EmptyMedia>
      <EmptyTitle>
        <Heading>{ended ? t("You've been logged out") : t("Log in to continue")}</Heading>
      </EmptyTitle>
      {ended && <EmptyDescription>{t("Log in to get back to your plan.")}</EmptyDescription>}
    </EmptyHeader>
  );

  if (bar) {
    return (
      <>
        <Empty className={cn("flex-1", className)} data-account-ask>
          {words}
          {startLink && <EmptyContent>{startLink}</EmptyContent>}
        </Empty>
        <BottomBar>
          <BottomBarActions>{main}</BottomBarActions>
        </BottomBar>
      </>
    );
  }

  return (
    <Empty className={className} data-account-ask>
      {words}
      <EmptyContent>
        <div className="flex flex-wrap gap-2">
          {main}
          {startLink}
        </div>
      </EmptyContent>
    </Empty>
  );
}

export function AuthGateScreen({ next }: { next: string }) {
  return (
    <ColumnScreen width="message">
      <AuthGate bar heading="h1" next={next} />
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
      <AuthGate bar ended={ended} next={next} />
    </GatedPage>
  );
}
