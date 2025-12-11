"use client";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@zoonk/ui/components/command";
import { HomeIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";
import { useRouter } from "@/i18n/navigation";
import { useCommandPalette } from "./command-palette-provider";
import { CommandPaletteSearch } from "./command-palette-search";

type CommandPaletteDialogProps = {
  children: React.ReactNode;
};

export function CommandPaletteDialog({ children }: CommandPaletteDialogProps) {
  const { push } = useRouter();
  const params = useParams();
  const t = useExtracted();
  const { isOpen, close } = useCommandPalette();
  const [query, setQuery] = useQueryState("q", { shallow: false });

  const orgSlug = params.orgSlug as string;

  const closePalette = () => {
    close();
    void setQuery("");
  };

  const onSelectItem = (item: string) => {
    closePalette();
    push(item);
  };

  const staticPages = [
    {
      icon: HomeIcon,
      key: t("Home page"),
      url: `/${orgSlug}`,
    },
  ];

  const filteredStaticPages = staticPages.filter((page) =>
    page.key.toLowerCase().includes((query ?? "").toLowerCase().trim()),
  );

  return (
    <CommandDialog
      className="top-4 translate-y-0 lg:top-1/2 lg:translate-y-[-50%]"
      closeLabel={t("Close search")}
      description={t("Search courses or pages...")}
      onOpenChange={closePalette}
      open={isOpen}
      shouldFilter={false}
      title={t("Search")}
    >
      <CommandPaletteSearch />

      <CommandList>
        <CommandEmpty>
          <p>{t("No results found")}</p>
        </CommandEmpty>

        {children}

        {filteredStaticPages.length > 0 && (
          <CommandGroup heading={t("Pages")}>
            {filteredStaticPages.map((item) => (
              <CommandItem
                key={item.key}
                onSelect={() => onSelectItem(item.url)}
              >
                <item.icon aria-hidden="true" />
                {item.key}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
