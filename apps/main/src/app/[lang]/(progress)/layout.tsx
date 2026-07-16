import { Suspense } from "react";
import { ProgressNavbar, ProgressNavbarSkeleton } from "./_components/progress-navbar";

export default async function ProgressLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Suspense fallback={<ProgressNavbarSkeleton />}>
        <ProgressNavbar />
      </Suspense>
      {children}
    </div>
  );
}
