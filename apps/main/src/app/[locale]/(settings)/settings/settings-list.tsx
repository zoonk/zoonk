import {
  Item,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@zoonk/ui/components/item";
import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";

const settingsPages = [
  "subscription",
  "displayName",
  "language",
  "feedback",
  "help",
  "follow",
] as const;

export async function SettingsList() {
  const t = await getTranslations("Menu");

  return (
    <ItemGroup>
      {settingsPages.map((page) => {
        const menuItem = getMenu(page);
        const label = t(page);

        return (
          <Item asChild key={page}>
            <Link href={menuItem.url}>
              <ItemMedia variant="icon">
                <menuItem.icon aria-hidden="true" />
              </ItemMedia>

              <ItemContent>
                <ItemTitle>{label}</ItemTitle>
              </ItemContent>

              <ChevronRight
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
            </Link>
          </Item>
        );
      })}
    </ItemGroup>
  );
}
