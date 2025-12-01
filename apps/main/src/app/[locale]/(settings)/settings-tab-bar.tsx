import {
  TabBar,
  TabBarCloseAction,
  TabBarItem,
  TabOverflow,
  TabOverflowIMenutem,
  TabOverflowMenu,
  TabOverflowTrigger,
} from "@/components/tab-bar";
import { settingsMenu } from "./settings-menu";

const MOBILE_VISIBLE_COUNT = 5;

export async function SettingsTabBar() {
  const { settingsPages } = await settingsMenu();

  const visiblePages = settingsPages.slice(0, MOBILE_VISIBLE_COUNT);
  const overflowPages = settingsPages.slice(MOBILE_VISIBLE_COUNT);
  const overflowPageUrls = overflowPages.map((page) => page.url);

  return (
    <TabBar action={<TabBarCloseAction />}>
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
        <TabBarItem
          className="hidden md:block"
          href={page.url}
          icon={<page.icon aria-hidden="true" />}
          key={page.label}
          label={page.label}
        />
      ))}
    </TabBar>
  );
}
