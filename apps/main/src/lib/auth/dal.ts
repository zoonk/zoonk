import "server-only";

import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "./index";

export const verifySession = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { isAuth: false, user: null, userId: null };
  }

  return { isAuth: true, user: session.user, userId: session.user.id };
});
