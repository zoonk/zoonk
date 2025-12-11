import { getOrganizationBySlug } from "@zoonk/core/organizations";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/[orgSlug]">): Promise<Metadata> {
  const { orgSlug } = await params;
  const { data: org } = await getOrganizationBySlug(orgSlug);

  if (!org) {
    return {};
  }

  return { title: org.name };
}

export default function OrgHomePage() {
  return <div>{}</div>;
}
