import { auth } from "@zoonk/auth";
import {
  getOrganizationBySlug,
  hasCoursePermission,
} from "@zoonk/core/organizations";
import { headers } from "next/headers";
import { notFound, unauthorized } from "next/navigation";
import { Suspense } from "react";
import { EditorNavbar } from "./navbar";

async function LayoutPermissions({
  children,
  params,
}: {
  children: React.ReactNode;
  params: LayoutProps<"/[locale]/[orgSlug]">["params"];
}) {
  const { orgSlug } = await params;
  const { data: org } = await getOrganizationBySlug(orgSlug);

  if (!org) {
    return notFound();
  }

  const canViewPage = await hasCoursePermission(org.id, "update");

  if (!canViewPage) {
    return unauthorized();
  }

  // We're setting the current org as the active one,
  // so we can automatically redirect users to this org
  // next time they visit the editor
  await auth.api.setActiveOrganization({
    body: { organizationSlug: orgSlug },
    headers: await headers(),
  });

  return <div>{children}</div>;
}

export default async function OrgHomeLayout({
  children,
  params,
}: LayoutProps<"/[locale]/[orgSlug]">) {
  return (
    <Suspense>
      <LayoutPermissions params={params}>
        <EditorNavbar />

        {children}
      </LayoutPermissions>
    </Suspense>
  );
}
