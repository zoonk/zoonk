import { UserAvatar } from "@/app/[lang]/(catalog)/_components/user-avatar";
import { SectionNavSkeleton } from "@/components/learn/section-nav";
import { getSession } from "@zoonk/core/users/session";
import { SettingsNavLinks } from "./settings-links";
import { getSettingsPagesShown } from "./settings-pages-shown";

/** Whose settings these are, above the sidebar: an account's photo, name and email. */
async function SidebarIdentity() {
  const session = await getSession();

  if (!session || session.user.isAnonymous) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 px-2.5 py-1">
      <span className="flex size-10 shrink-0 overflow-hidden rounded-full">
        <UserAvatar />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold">{session.user.name}</span>
        <span className="text-muted-foreground truncate text-xs">{session.user.email}</span>
      </span>
    </div>
  );
}

/** The settings pages beside each settings page from `lg`, under whose account it is. */
export async function SettingsNavbar() {
  return <SettingsNavLinks {...await getSettingsPagesShown()} header={<SidebarIdentity />} />;
}

/** Holds the sidebar's place while the session-dependent pages resolve on a cold page load. */
export function SettingsNavbarSkeleton() {
  return <SectionNavSkeleton />;
}
