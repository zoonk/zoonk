"use client";

import {
  Item,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@zoonk/ui/components/item";
import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
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

          <ChevronRight
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
        </Item>
      ))}
    </ItemGroup>
  );
}
