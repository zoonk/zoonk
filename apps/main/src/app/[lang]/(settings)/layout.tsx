import { Suspense } from "react";
import { SettingsNavbar, SettingsNavbarSkeleton } from "./_components/settings-navbar";

export default async function Layout({ children }: LayoutProps<"/[lang]">) {
  return (
    <div className="flex min-h-dvh flex-col gap-4 overflow-x-hidden">
      <Suspense fallback={<SettingsNavbarSkeleton />}>
        <SettingsNavbar />
      </Suspense>
      {children}
    </div>
  );
}
