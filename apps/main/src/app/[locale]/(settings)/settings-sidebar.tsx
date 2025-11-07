import { Sidebar, SidebarContent } from "@zoonk/ui/components/sidebar";
import { getExtracted } from "next-intl/server";
import { SettingsSidebarAccount } from "./settings-sidebar-account";
import { SettingsSidebarFooter } from "./settings-sidebar-footer";
import { SettingsSidebarHeader } from "./settings-sidebar-header";

export async function SettingsSidebar() {
  const t = await getExtracted();

  return (
    <Sidebar
      closeLabel={t("Close")}
      collapsible="icon"
      description={t("Navigate to all settings")}
      title={t("Settings sidebar")}
    >
      <SettingsSidebarHeader />

      <SidebarContent>
        <SettingsSidebarAccount />
      </SidebarContent>

      <SettingsSidebarFooter />
    </Sidebar>
  );
}
