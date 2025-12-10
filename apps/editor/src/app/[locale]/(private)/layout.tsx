import { Suspense } from "react";
import { EditorNavbar } from "./navbar";

export default function PrivateLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <>
      <Suspense>
        <EditorNavbar />
      </Suspense>

      {children}
    </>
  );
}
