import { auth } from "@zoonk/auth";
import {
  getOrganizationBySlug,
  hasCoursePermission,
} from "@zoonk/core/organizations";
import { headers } from "next/headers";
import { notFound, unauthorized } from "next/navigation";
import { Suspense } from "react";
import { EditorNavbar } from "@/components/navbar";

async function LayoutPermissions({
  children,
  navbarActions,
  params,
}: {
  children: React.ReactNode;
  navbarActions: React.ReactNode;
  params: LayoutProps<"/[locale]/[orgSlug]">["params"];
}) {
  const { orgSlug } = await params;
  const [org, canViewPage] = await Promise.all([
    getOrganizationBySlug(orgSlug),
    hasCoursePermission({
      orgSlug,
      permission: "update",
    }),
    // We're setting the current org as the active one,
    // so we can automatically redirect users to this org
    // next time they visit the editor
    auth.api.setActiveOrganization({
      body: { organizationSlug: orgSlug },
      headers: await headers(),
    }),
  ]);

  if (!org.data) {
    return notFound();
  }

  if (!canViewPage) {
    return unauthorized();
  }

  return (
    <div>
      <EditorNavbar>{navbarActions}</EditorNavbar>

      {children}
    </div>
  );
}

export default async function OrgHomeLayout({
  children,
  navbarActions,
  params,
}: LayoutProps<"/[locale]/[orgSlug]"> & { navbarActions: React.ReactNode }) {
  return (
    <Suspense>
      <LayoutPermissions navbarActions={navbarActions} params={params}>
        {children}
      </LayoutPermissions>
    </Suspense>
  );
}
