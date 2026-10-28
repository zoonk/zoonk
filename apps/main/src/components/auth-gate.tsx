import { PublicTopBar } from "@/components/public/public-top-bar";
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
import { LockIcon } from "lucide-react";
import { getExtracted, getLocale } from "next-intl/server";
import { cookies } from "next/headers";

/** A browser whose session ended is told so on every page, since its plan is still there. */
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
  const locale = await getLocale();
  const ended = knownEnded ?? (!session && hasSessionCookie(await cookies()));
  const loginHref = `${getPathname({ href: "/login", locale })}?next=${encodeURIComponent(getPathname({ href: next, locale }))}`;

  if (session?.user.isAnonymous) {
    return (
      <Empty className={className}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LockIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>
            <Heading>{t("Create an account to use this page")}</Heading>
          </EmptyTitle>
          <EmptyDescription>
            {t("Your plan and progress move to your account, safe on any device.")}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <a className={buttonVariants()} href={loginHref}>
            {t("Create an account")}
          </a>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Empty className={className}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LockIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>
          <Heading>{ended ? t("Your session ended") : t("Log in to continue")}</Heading>
        </EmptyTitle>
        <EmptyDescription>
          {ended
            ? t("Log in to pick up your plan.")
            : t("Log in to pick up where you left off, or start free.")}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap gap-2">
          <a className={buttonVariants()} href={loginHref}>
            {t("Log in")}
          </a>
          <Link className={buttonVariants({ variant: "outline" })} href="/start">
            {ended ? t("Start something new") : t("Start free")}
          </Link>
        </div>
      </EmptyContent>
    </Empty>
  );
}

export function AuthGateScreen({ next }: { next: string }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicTopBar actions={null} />
      <main className="max-w-column mx-auto flex w-full flex-1 flex-col px-4">
        <AuthGate className="py-16" heading="h1" next={next} />
      </main>
    </div>
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
