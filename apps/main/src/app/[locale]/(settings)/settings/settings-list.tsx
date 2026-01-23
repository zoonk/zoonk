"use client";

import { Link } from "@/i18n/navigation";
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "@zoonk/ui/components/item";
import { ChevronRight } from "lucide-react";
import { useSettings } from "../_hooks/use-settings";

export function SettingsList() {
  const { menuPages } = useSettings();

  return (
    <ItemGroup className="gap-4">
      {menuPages.map((page) => (
        <Item key={page.label} render={<Link href={page.url} />}>
          <ItemMedia variant="icon">
            <page.icon aria-hidden="true" />
          </ItemMedia>

          <ItemContent>
            <ItemTitle>{page.label}</ItemTitle>
          </ItemContent>

          <ChevronRight aria-hidden="true" className="text-muted-foreground size-4" />
        </Item>
      ))}
    </ItemGroup>
  );
}
