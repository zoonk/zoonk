import { AuthGateAction } from "@/components/auth-gate-action";
import { ColumnScreen } from "@/components/public/column-screen";
import { getAppLocale } from "@/i18n/locale";
import { getPathname } from "@/i18n/navigation";
import { getSession } from "@zoonk/core/users/session";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { CliLoginForm } from "./cli-login-form";

type Props = PageProps<"/[lang]/device">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return { robots: { follow: false, index: false }, title: t("Log in to the Zoonk CLI") };
}

function CliLoginSkeleton() {
  return (
    <div className="mt-2 flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-11 w-32 rounded-lg" />
        <Skeleton className="h-11 w-24 rounded-lg" />
      </div>
    </div>
  );
}

async function CliLoginBody({ searchParams }: Pick<Props, "searchParams">) {
  const t = await getExtracted();

  const [{ user_code: userCodeParam }, session, locale] = await Promise.all([
    searchParams,
    getSession(),
    getAppLocale(),
  ]);

  const userCode = typeof userCodeParam === "string" ? userCodeParam : undefined;

  if (!session || session.user.isAnonymous) {
    const back = getPathname({
      href: userCode ? { pathname: "/device", query: { user_code: userCode } } : "/device",
      locale,
    });

    return (
      <>
        <p className="text-muted-foreground -mt-3 flex-1 text-pretty">
          {t("Log in with your Zoonk staff account first. You'll come back here to approve it.")}
        </p>
        <BottomBar>
          <BottomBarActions>
            <AuthGateAction
              href={`${getPathname({ href: "/login", locale })}?next=${encodeURIComponent(back)}`}
            >
              {t("Log in")}
            </AuthGateAction>
          </BottomBarActions>
        </BottomBar>
      </>
    );
  }

  return <CliLoginForm email={session.user.email} userCode={userCode} />;
}

/** Where `pnpm zoonk login` sends staff to approve the login it started; the provider names this page. */
export default async function CliLoginPage({ searchParams }: Props) {
  const t = await getExtracted();

  return (
    <ColumnScreen>
      <h1 className="text-title">{t("Log in to the Zoonk CLI")}</h1>

      <Suspense fallback={<CliLoginSkeleton />}>
        <CliLoginBody searchParams={searchParams} />
      </Suspense>
    </ColumnScreen>
  );
}
