import { AdminPage, AdminPageBody, AdminPageHeader } from "@/components/admin-page";
import { getSafeAppRelativePath } from "@zoonk/core/auth/ott/redirect";
import { ADMIN_URL } from "@zoonk/utils/url";
import { type Metadata } from "next";
import { Suspense } from "react";
import { CLI_LOGINS_PAGE, adminPages } from "../admin-navigation";
import { CliLoginList, CliLoginListSkeleton } from "./cli-login-list";

export const metadata: Metadata = { title: "CLI logins" };

const HOME = { href: "/", label: "Home" };

function returnPage(from: string | string[] | undefined) {
  const safePath = getSafeAppRelativePath(from);

  if (!safePath) {
    return HOME;
  }

  const { pathname } = new URL(safePath, ADMIN_URL);
  const page = adminPages.findLast(({ url }) => pathname === url || pathname.startsWith(`${url}/`));

  return page && page !== CLI_LOGINS_PAGE ? { href: pathname, label: page.label } : HOME;
}

function CliLoginsHeader({ parent }: { parent: typeof HOME }) {
  return (
    <AdminPageHeader parent={parent} title="CLI logins">
      Staff logged in to the Zoonk CLI.
    </AdminPageHeader>
  );
}

async function CliLoginsHeaderFromPage({
  searchParams,
}: Pick<PageProps<"/cli-logins">, "searchParams">) {
  const { from } = await searchParams;

  return <CliLoginsHeader parent={returnPage(from)} />;
}

export default function CliLoginsPage({ searchParams }: PageProps<"/cli-logins">) {
  return (
    <AdminPage>
      <Suspense fallback={<CliLoginsHeader parent={HOME} />}>
        <CliLoginsHeaderFromPage searchParams={searchParams} />
      </Suspense>

      <AdminPageBody>
        <Suspense fallback={<CliLoginListSkeleton />}>
          <CliLoginList />
        </Suspense>
      </AdminPageBody>
    </AdminPage>
  );
}
