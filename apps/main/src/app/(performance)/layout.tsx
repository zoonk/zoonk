import { PerformanceNavbar } from "./_components/performance-navbar";

export default async function PerformanceLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PerformanceNavbar />
      {children}
    </div>
  );
}
