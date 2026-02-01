import { findOrganizationById } from "@zoonk/core/orgs/find";
import { listUserOrgs } from "@zoonk/core/users/orgs/list";
import { getSession } from "@zoonk/core/users/session/get";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { redirect, unauthorized } from "next/navigation";
import { Suspense } from "react";

async function HomePageContent() {
  const [userSession, orgs] = await Promise.all([getSession(), listUserOrgs()]);

  const firstOrg = orgs.data[0];

  const activeOrganizationId = userSession?.session.activeOrganizationId ?? firstOrg?.id;

  const activeOrganization = findOrganizationById(orgs.data, activeOrganizationId);

  if (activeOrganization) {
    redirect(`/${activeOrganization.slug}`);
  }

  // Restrict access when they don't belong to any organization
  return unauthorized();
}

export default function HomePage() {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <HomePageContent />
    </Suspense>
  );
}
