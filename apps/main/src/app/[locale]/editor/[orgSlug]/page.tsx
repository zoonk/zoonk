import type { Metadata } from "next";
import { cacheTag } from "next/cache";
import { getExtracted } from "next-intl/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/editor/[orgSlug]">): Promise<Metadata> {
  "use cache";
  cacheTag("max");

  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    title: t("Editor"),
  };
}

export default async function EditorOverview() {
  return <div>{}</div>;
}
