import { getTranslations } from "next-intl/server";
import { SidebarHeader, SidebarTrigger } from "@/components/ui/sidebar";

export async function SettingsSidebarHeader() {
  const t = await getTranslations("Menu");

  return (
    <SidebarHeader>
      <SidebarTrigger toggleLabel={t("toggleSidebar")} />
    </SidebarHeader>
  );
}
