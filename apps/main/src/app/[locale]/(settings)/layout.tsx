"use cache";

import { setRequestLocale } from "next-intl/server";
import { SettingsNavbar } from "./_components/settings-navbar";

export default async function Layout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-dvh flex-col">
      <SettingsNavbar />
      {children}
    </div>
  );
}
