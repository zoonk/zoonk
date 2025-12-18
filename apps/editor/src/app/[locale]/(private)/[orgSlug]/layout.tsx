import { Suspense } from "react";
import { EditorNavbar, NavbarSkeleton } from "@/components/navbar";

export default async function Layout({
  children,
}: LayoutProps<"/[locale]/[orgSlug]">) {
  return (
    <>
      <Suspense fallback={<NavbarSkeleton />}>
        <EditorNavbar />
      </Suspense>

      {children}
    </>
  );
}
