import { Sidebar, SidebarContent } from "@zoonk/ui/components/sidebar";
import { getTranslations } from "next-intl/server";
import { SettingsSidebarAccount } from "./settings-sidebar-account";
import { SettingsSidebarFooter } from "./settings-sidebar-footer";
import { SettingsSidebarHeader } from "./settings-sidebar-header";

export async function SettingsSidebar() {
  const t = await getTranslations("Menu");

  return (
    <Sidebar
      closeLabel={t("close")}
      collapsible="icon"
      description={t("settingsSidebarDescription")}
      title={t("settingsSidebarTitle")}
    >
      <SettingsSidebarHeader />

      <SidebarContent>
        <SettingsSidebarAccount />
      </SidebarContent>

      <SettingsSidebarFooter />
    </Sidebar>
  );
}
