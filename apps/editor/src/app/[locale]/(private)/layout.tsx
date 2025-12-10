import { EditorNavbar } from "./navbar";

export default function PrivateLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <>
      <EditorNavbar />
      {children}
    </>
  );
}
