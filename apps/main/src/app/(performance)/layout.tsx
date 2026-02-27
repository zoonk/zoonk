import { Suspense } from "react";
import { PerformanceNavbar, PerformanceNavbarSkeleton } from "./_components/performance-navbar";

export default async function PerformanceLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Suspense fallback={<PerformanceNavbarSkeleton />}>
        <PerformanceNavbar />
      </Suspense>
      {children}
    </div>
  );
}
