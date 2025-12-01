import { FullPageLoading } from "@zoonk/ui/components/loading";
import type { Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { EditorHomeView } from "./editor-home-view";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/editor">): Promise<Metadata> {
  "use cache";

  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    title: t("Editor"),
  };
}

export default async function EditorHome() {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <EditorHomeView />
    </Suspense>
  );
}
