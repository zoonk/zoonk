import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "./index";

export const verifySession = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { isAuth: false, userId: null, user: null };
  }

  return { isAuth: true, userId: session.user.id, user: session.user };
});
