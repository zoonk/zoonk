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
import { useSettings } from "../use-settings";

export function SettingsList() {
  const { menuPages } = useSettings();

  return (
    <ItemGroup>
      {menuPages.map((page) => (
        <Item asChild key={page.label}>
          <Link href={page.url}>
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
          </Link>
        </Item>
      ))}
    </ItemGroup>
  );
}
