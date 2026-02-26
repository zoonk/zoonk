import { SettingsNavbar } from "./_components/settings-navbar";

export default async function Layout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col gap-4 overflow-x-hidden">
      <SettingsNavbar />
      {children}
    </div>
  );
}
