import { Suspense } from "react";
import { EditorNavbar } from "@/components/navbar";

export default async function Layout({
  children,
}: LayoutProps<"/[locale]/[orgSlug]">) {
  return (
    <>
      <Suspense>
        <EditorNavbar />
      </Suspense>

      {children}
    </>
  );
}
