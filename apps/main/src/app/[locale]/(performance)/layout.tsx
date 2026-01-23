import { setRequestLocale } from "next-intl/server";
import { PerformanceNavbar } from "./_components/performance-navbar";

export default async function PerformanceLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-dvh flex-col">
      <PerformanceNavbar />
      {children}
    </div>
  );
}
