import { CommandPalette } from "@/app/[lang]/(catalog)/_components/command-palette";
import { getSession } from "@zoonk/core/users/session";

/**
 * A visitor's Cmd/Ctrl+K palette in the app's frame, with the public pages. Anyone with a session
 * already has the root layout's palette, with their own places.
 */
export async function VisitorCommandPalette() {
  const session = await getSession();
  return session ? null : <CommandPalette isLoggedIn={false} />;
}
