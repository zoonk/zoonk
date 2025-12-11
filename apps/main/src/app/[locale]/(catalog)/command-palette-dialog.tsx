"use client";

import { useLogout } from "@zoonk/auth/hooks/logout";
import {
  type CommandPaletteStaticPage,
  CommandPaletteDialog as Dialog,
} from "@zoonk/next/patterns/command-palette/command-palette-dialog";
import {
  Brain,
  Gem,
  Home,
  IdCardLanyard,
  Languages,
  LayoutGrid,
  LifeBuoy,
  LogIn,
  LogOut,
  Megaphone,
  MessageCircle,
  Settings,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type CatalogCommandPaletteDialogProps = {
  children?: React.ReactNode;
};

export function CatalogCommandPaletteDialog({
  children,
}: CatalogCommandPaletteDialogProps) {
  const { push } = useRouter();
  const t = useExtracted();
  const { isLoggedIn, logout } = useLogout({ onSuccess: () => push("/login") });

  const getStartedPages: CommandPaletteStaticPage[] = [
    { icon: Home, label: t("Home page"), url: "/" },
    { icon: LayoutGrid, label: t("Courses"), url: "/courses" },
    { icon: Brain, label: t("Learn something"), url: "/learn" },
  ];

  const accountPublicPages: CommandPaletteStaticPage[] = [
    { icon: LogIn, label: t("Login"), url: "/login" },
    { icon: Languages, label: t("Language"), url: "/language" },
  ];

  const accountPrivatePages: CommandPaletteStaticPage[] = [
    { icon: LayoutGrid, label: t("My courses"), url: "/my" },
    { icon: Gem, label: t("Manage subscription"), url: "/subscription" },
    { icon: Settings, label: t("Manage settings"), url: "/settings" },
    { icon: Languages, label: t("Update language"), url: "/language" },
    { icon: IdCardLanyard, label: t("Update display name"), url: "/name" },
  ];

  const contactUsPages: CommandPaletteStaticPage[] = [
    { icon: MessageCircle, label: t("Send feedback"), url: "/feedback" },
    { icon: LifeBuoy, label: t("Help and support"), url: "/help" },
    { icon: Megaphone, label: t("Follow us on social media"), url: "/follow" },
  ];

  // Combine all static pages into a single list for filtering
  const allStaticPages: CommandPaletteStaticPage[] = [
    ...getStartedPages,
    ...(isLoggedIn ? accountPrivatePages : accountPublicPages),
    ...contactUsPages,
  ];

  // Add logout as a custom action if logged in
  if (isLoggedIn) {
    allStaticPages.push({
      icon: LogOut,
      label: t("Logout"),
      url: "__logout__", // Special marker for logout action
    });
  }

  const handleSelect = (url: string) => {
    if (url === "__logout__") {
      logout();
    } else {
      push(url);
    }
  };

  return (
    <Dialog
      labels={{
        close: t("Close search"),
        description: t("Search courses or pages..."),
        emptyText: t("No results found"),
        pagesHeading: t("Pages"),
        placeholder: t("Search courses or pages..."),
        title: t("Search"),
      }}
      onSelect={handleSelect}
      staticPages={allStaticPages}
    >
      {children}
    </Dialog>
  );
}
