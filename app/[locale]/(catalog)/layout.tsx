import { Navbar } from "@/components/Navbar";

export default function CatalogLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}
