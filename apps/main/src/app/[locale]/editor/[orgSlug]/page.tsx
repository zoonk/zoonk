import type { Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { EditorHeader } from "@/components/editor/editor-header";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/editor/[orgSlug]">): Promise<Metadata> {
  "use cache";

  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    title: t("Editor"),
  };
}

export default async function EditorOverview({
  params,
}: PageProps<"/[locale]/editor/[orgSlug]">) {
  const { orgSlug } = await params;

  return (
    <>
      <EditorHeader active="overview" orgSlug={orgSlug} />
      <main>{}</main>
    </>
  );
}
