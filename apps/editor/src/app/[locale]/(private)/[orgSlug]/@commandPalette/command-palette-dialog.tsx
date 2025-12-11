"use client";

import { CommandPaletteDialog as Dialog } from "@zoonk/next/patterns/command";
import { HomeIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useExtracted } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function CommandPaletteDialog({ children }: React.PropsWithChildren) {
  const { push } = useRouter();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const t = useExtracted();

  const staticPages = [
    {
      icon: HomeIcon,
      label: t("Home page"),
      url: `/${orgSlug}`,
    },
  ];

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
      onSelect={push}
      staticPages={staticPages}
    >
      {children}
    </Dialog>
  );
}
