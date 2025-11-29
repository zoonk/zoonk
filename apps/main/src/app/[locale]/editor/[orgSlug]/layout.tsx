import { FullPageLoading } from "@zoonk/ui/components/loading";
import type { Metadata } from "next";
import { Suspense } from "react";
import { EditorPermissions } from "./editor-permissions";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
};

export default async function EditorLayout({
  children,
  params,
}: LayoutProps<"/[locale]/editor/[orgSlug]">) {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <EditorPermissions params={params}>{children}</EditorPermissions>
    </Suspense>
  );
}
