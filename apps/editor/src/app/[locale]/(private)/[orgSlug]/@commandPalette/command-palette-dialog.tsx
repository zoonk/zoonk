"use client";

import { CommandPaletteDialog as Dialog } from "@zoonk/next/patterns/command";
import { HomeIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useExtracted } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type EditorCommandPaletteDialogProps = {
  children: React.ReactNode;
};

export function CommandPaletteDialog({
  children,
}: EditorCommandPaletteDialogProps) {
  const { push } = useRouter();
  const params = useParams<{ orgSlug: string }>();
  const t = useExtracted();

  const orgSlug = params.orgSlug;

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
