import { FullPageLoading } from "@zoonk/ui/components/loading";
import { Suspense } from "react";
import { EditorPermissions } from "./editor-permissions";

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
