import { findAvailableUsername } from "./available-username";
import { type UserCreateBeforeHook } from "./user-create-hooks";

const BROWSER_PROVIDER_CALLBACK = "/callback/:id";

/**
 * Only browser Google or Apple sign-ups get a username from their email. Email sign-ups and the
 * native apps ask for one in their own setup screens.
 */
export const nameProviderAccount: UserCreateBeforeHook = async (user, context) => {
  if (context?.path !== BROWSER_PROVIDER_CALLBACK || !user.name.trim()) {
    return { data: user };
  }

  const username = await findAvailableUsername(user.email);

  return { data: username ? { ...user, displayUsername: username, username } : user };
};
