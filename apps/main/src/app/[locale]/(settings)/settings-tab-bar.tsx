import { buttonVariants } from "@zoonk/ui/components/button";
import { X } from "lucide-react";
import { getExtracted } from "next-intl/server";
import {
  TabBar,
  TabBarItem,
  TabOverflow,
  TabOverflowIMenutem,
  TabOverflowMenu,
  TabOverflowTrigger,
} from "@/components/tab-bar";
import { Link } from "@/i18n/navigation";
import { settingsMenu } from "./settings-menu";

const MOBILE_VISIBLE_COUNT = 5;

export async function SettingsTabBar() {
  const t = await getExtracted();
  const { settingsPages } = await settingsMenu();

  const visiblePages = settingsPages.slice(0, MOBILE_VISIBLE_COUNT);
  const overflowPages = settingsPages.slice(MOBILE_VISIBLE_COUNT);
  const overflowPageUrls = overflowPages.map((page) => page.url);

  return (
    <TabBar
      action={
        <Link
          className={buttonVariants({ size: "icon", variant: "ghost" })}
          href="/"
        >
          <X aria-hidden="true" />
          <span className="sr-only">{t("Home")}</span>
        </Link>
      }
    >
      {/* Mobile: Show first 5 items */}
      {visiblePages.map((page) => (
        <TabBarItem
          href={page.url}
          icon={<page.icon aria-hidden="true" />}
          key={page.label}
          label={page.label}
        />
      ))}

      {/* Mobile: Show overflow menu for remaining items */}
      {overflowPages.length > 0 && (
        <TabOverflow>
          <TabOverflowTrigger pages={overflowPageUrls} />

          <TabOverflowMenu>
            {overflowPages.map((page) => (
              <TabOverflowIMenutem
                icon={<page.icon aria-hidden="true" />}
                key={page.url}
                label={page.label}
                url={page.url}
              />
            ))}
          </TabOverflowMenu>
        </TabOverflow>
      )}

      {/* Desktop: Show remaining items directly */}
      {overflowPages.map((page) => (
        <div className="hidden md:block" key={page.label}>
          <TabBarItem
            href={page.url}
            icon={<page.icon aria-hidden="true" />}
            label={page.label}
          />
        </div>
      ))}
    </TabBar>
  );
}
