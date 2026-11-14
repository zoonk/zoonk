import { ColumnScreen } from "@/components/public/column-screen";
import { getAppLocale } from "@/i18n/locale";
import { Link, getPathname } from "@/i18n/navigation";
import { hasSessionCookie } from "@zoonk/auth/cookies";
import { getSession } from "@zoonk/core/users/session";
import { AccountAskMark } from "@zoonk/learn/account-ask";
import { EnterLink } from "@zoonk/learn/enter-button";
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
import { PendingLink } from "@zoonk/ui/patterns/links/pending";
import { LockIcon, LogInIcon, UserPlusIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { cookies } from "next/headers";

type Gate = {
  /** The page to come back to after logging in, localized and ready for a query. */
  back: string;
  kind: "account" | "ended" | "login";
};

/** A guest is asked for an account; a browser whose session ended is told so, since its plan is still there. */
async function readGate({ ended, next }: { ended?: boolean; next: string }): Promise<Gate> {
  const session = await getSession();
  const locale = await getAppLocale();
  const back = encodeURIComponent(getPathname({ href: next, locale }));

  if (session?.user.isAnonymous) {
    return { back, kind: "account" };
  }

  const isEnded = ended ?? (!session && hasSessionCookie(await cookies()));
  return { back, kind: isEnded ? "ended" : "login" };
}

async function GateMessage({
  children,
  className,
  gate,
  heading: Heading = "h2",
}: {
  children?: React.ReactNode;
  className?: string;
  gate: Gate;
  heading?: "h1" | "h2";
}) {
  const t = await getExtracted();

  const words = {
    account: {
      description: t("Your plan and progress move to your account, safe on any device."),
      title: t("Create an account to use this page"),
    },
    ended: { description: t("Log in to pick up your plan."), title: t("Your session ended") },
    login: {
      description: t("Log in to pick up where you left off, or start free."),
      title: t("Log in to continue"),
    },
  }[gate.kind];

  return (
    <Empty className={className} data-account-ask>
      <AccountAskMark />
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LockIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>
          <Heading>{words.title}</Heading>
        </EmptyTitle>
        <EmptyDescription>{words.description}</EmptyDescription>
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  );
}

/**
 * The gate inside a page's own content, such as a step of onboarding, with its links under it; as
 * the page's whole content (`bar`), its links are the bottom bar's.
 */
export async function AuthGate({
  bar,
  className,
  ended,
  heading,
  next,
}: {
  bar?: boolean;
  className?: string;
  ended?: boolean;
  heading?: "h1" | "h2";
  next: string;
}) {
  const t = await getExtracted();
  const gate = await readGate({ ended, next });

  if (bar) {
    return (
      <>
        <GateMessage className={cn("flex-1", className)} gate={gate} heading={heading} />
        <GateBar gate={gate} />
      </>
    );
  }

  const loginHref = `${getPathname({ href: "/login", locale: await getAppLocale() })}?next=${gate.back}`;

  return (
    <GateMessage className={className} gate={gate} heading={heading}>
      {gate.kind === "account" ? (
        <PendingLink
          className={buttonVariants()}
          href={loginHref}
          icon={<UserPlusIcon aria-hidden="true" />}
        >
          {t("Create an account")}
        </PendingLink>
      ) : (
        <div className="flex flex-wrap gap-2">
          <PendingLink
            className={buttonVariants()}
            href={loginHref}
            icon={<LogInIcon aria-hidden="true" />}
          >
            {t("Log in")}
          </PendingLink>
          <Link className={buttonVariants({ variant: "outline" })} href="/start">
            {gate.kind === "ended" ? t("Start something new") : t("Start free")}
          </Link>
        </div>
      )}
    </GateMessage>
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

/** A whole page's gate: its ways in are the bottom bar's. */
async function GateBar({ gate }: { gate: Gate }) {
  const t = await getExtracted();

  return (
    <BottomBar>
      <BottomBarActions>
        {gate.kind !== "account" && (
          <Link className={buttonVariants({ size: "xl", variant: "outline" })} href="/start">
            {gate.kind === "ended" ? t("Start something new") : t("Start free")}
          </Link>
        )}

        <EnterLink href={`/login?next=${gate.back}`}>
          {gate.kind === "account" ? t("Create an account") : t("Log in")}
        </EnterLink>
      </BottomBarActions>
    </BottomBar>
  );
}

export async function AuthGatePage({
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
  const gate = await readGate({ ended, next });

  return (
    <GatedPage description={description} title={title}>
      <GateMessage gate={gate} />

      <GateBar gate={gate} />
    </GatedPage>
  );
}
