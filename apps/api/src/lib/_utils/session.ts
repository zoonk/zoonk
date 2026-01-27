import { auth } from "@zoonk/auth";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest } from "next/server";

export type UserInfo = {
  id: number;
  sessionId: number;
};

export async function getUser(req: NextRequest): Promise<UserInfo | null> {
  const { data: session } = await safeAsync(() => auth.api.getSession({ headers: req.headers }));

  if (!session?.user) {
    return null;
  }

  return { id: Number(session.user.id), sessionId: Number(session.session.id) };
}
