import { LearnerWitness } from "@/components/learner/learner-witness";
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

/**
 * What a page that needs an account shows where its content would be, under the page's own title,
 * to someone without one, instead of sending them elsewhere: a visitor logs in and comes back to
 * this page (`next`), or starts free; a guest, whose session isn't an account yet, creates one. A
 * browser whose session ended (its cookie names no session; `ended` says so for a page that
 * already knows) is told so on every page, since its plan is still there, with starting something
 * new as the second way on.
 */
export async function AuthGate({
  className,
  ended: knownEnded,
  heading: Heading = "h2",
  next,
}: {
  className?: string;
  ended?: boolean;
  /** `h1` on a screen of its own (`AuthGateScreen`), with no page title over it. */
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
      <>
        <LearnerWitness />
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
      </>
    );
  }

  return (
    <>
      <LearnerWitness />
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
    </>
  );
}

/**
 * The gate on a screen of its own, for task pages that have no app frame around them (a lesson, a
 * mock, a practice): the public bar's brain goes home, and the gate stands in the page's column.
 */
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

/**
 * A tab or page shown without its content (no account, or no goal yet): its own header, its title
 * and one line on what it is, then what to do where the content would be. Every such page keeps
 * its title where the page has it, and the gate right under it.
 */
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

/** A page that needs an account, for someone without one: its header, then the gate. */
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
