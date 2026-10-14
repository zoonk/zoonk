import { findAvailableUsername } from "./available-username";
import { type UserCreateBeforeHook } from "./user-create-hooks";

/** Better Auth's route for the browser coming back from Google or Apple, where it creates those accounts. */
const BROWSER_PROVIDER_CALLBACK = "/callback/:id";

/**
 * A new account Google or Apple named in the browser gets a username made from its email as it's
 * created, instead of a screen asking for one; it can change both in its profile. Creating it is
 * the sign-up itself, so revisiting a page never names an account. An email sign-up has no name
 * yet, and the native apps ask in their own setup, so both keep their screens. With every
 * candidate taken it stays without one, and the setup screen asks.
 */
export const nameProviderAccount: UserCreateBeforeHook = async (user, context) => {
  if (context?.path !== BROWSER_PROVIDER_CALLBACK || !user.name.trim()) {
    return { data: user };
  }

  const username = await findAvailableUsername(user.email);

  return { data: username ? { ...user, displayUsername: username, username } : user };
};
