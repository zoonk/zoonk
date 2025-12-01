import {
  Item,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@zoonk/ui/components/item";
import { ChevronRight } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";

export async function SettingsList() {
  const t = await getExtracted();

  const settingsPages = [
    { label: t("Subscription"), ...getMenu("subscription") },
    { label: t("Language"), ...getMenu("language") },
    { label: t("Display Name"), ...getMenu("displayName") },
    { label: t("Feedback"), ...getMenu("feedback") },
    { label: t("Help"), ...getMenu("help") },
    { label: t("Follow"), ...getMenu("follow") },
  ];

  return (
    <ItemGroup>
      {settingsPages.map((page) => (
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
