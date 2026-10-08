import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { getAllowance } from "@zoonk/core/entitlements/get-allowance";
import { getBeltLevel } from "@zoonk/core/progress/get-belt-level";
import { getSession } from "@zoonk/core/users/session";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@zoonk/ui/components/dropdown-menu";
import { type LucideIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { AccountDropdownItem } from "./account-dropdown-item";
import { SearchDropdownItem } from "./search-dropdown-item";
import { UserAvatar } from "./user-avatar";

/**
 * Whose account the menu is: the photo or initial, the name and the email, and "Plus" when that's
 * the plan. Nothing for a guest.
 */
async function AccountIdentity({
  plus,
  session,
}: {
  plus: boolean;
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
}) {
  const t = await getExtracted();

  return (
    <>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="flex size-10 shrink-0 overflow-hidden rounded-full">
          <UserAvatar />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">{session.user.name}</span>
          <span className="text-muted-foreground truncate text-xs">{session.user.email}</span>
        </span>
        {plus && (
          <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-blue-600/10 px-2.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
            {t("Plus")}
          </span>
        )}
      </div>
      <DropdownMenuSeparator />
    </>
  );
}

type MenuEntry = { icon: LucideIcon; key: string; trail?: string; url: string };

function MenuGroup({ items }: { items: MenuEntry[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <>
      {items.map((menu) => (
        <DropdownMenuItem key={menu.url} render={<Link href={menu.url} prefetch />}>
          <menu.icon aria-hidden="true" />
          <span className="flex-1">{menu.key}</span>
          {menu.trail && (
            <span className="text-muted-foreground text-xs tabular-nums">{menu.trail}</span>
          )}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
    </>
  );
}

/**
 * The account menu: whose account it is (and "Plus" when it's the plan), the app's search (the same
 * palette Cmd/Ctrl+K opens), the learner's statistics (with their level) and the catalog, then
 * settings and help, and one way in or out. A
 * guest's session isn't an account yet, so it offers one instead of signing out (which would lose
 * the plan), and has no name to show.
 */
export async function UserDropdownMenu() {
  const [session, t, allowance, level] = await Promise.all([
    getSession(),
    getExtracted(),
    getAllowance(),
    getBeltLevel(),
  ]);

  const hasAccount = Boolean(session && !session.user.isAnonymous);

  const places = [
    session
      ? {
          key: t("Statistics"),
          trail: level ? t("Level {level}", { level: String(level.level) }) : undefined,
          ...getMenu("stats"),
        }
      : null,
    { key: t("Explore courses"), ...getMenu("courses") },
  ].filter((item) => item !== null);

  const settings = [
    { key: t("Settings"), ...getMenu("settings") },
    { key: t("Help"), ...getMenu("support") },
  ];

  return (
    <DropdownMenuContent align="end" className="w-64">
      {session && hasAccount && (
        <AccountIdentity plus={allowance?.tier === "plus"} session={session} />
      )}
      <SearchDropdownItem />
      <DropdownMenuSeparator />
      <MenuGroup items={places} />
      <MenuGroup items={settings} />
      <AccountDropdownItem status={getAccountStatus(session)} />
    </DropdownMenuContent>
  );
}

function getAccountStatus(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session) {
    return "visitor";
  }

  return session.user.isAnonymous ? "guest" : "account";
}
