import "server-only";
import { prisma } from "@zoonk/db";
import { getSession } from "../users/get-session";
import { deleteUnderageAccount } from "./_utils/delete-underage-account";

/** The device's under-13 answer stands for a day, the same as the cookie the web app keeps. */
const RETRY_WINDOW_MS = 86_400_000;

/**
 * An age answer from a device that said under 13 within the last day: an age screen that can be
 * retried until it lets a child in protects nobody (ANPD's draft age-assurance guide, Tabela 4;
 * FTC COPPA FAQ H.3). An account made since then is deleted, as an under-13 answer deletes one;
 * an older account belongs to someone who was already here, so its answer is saved as usual.
 * Clients sign the learner out after a deletion.
 */
export async function refuseAgeRetry(): Promise<{
  status: "accountDeleted" | "kept" | "unauthorized";
}> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const user = await prisma.user.findUnique({
    select: { createdAt: true },
    where: { id: session.user.id },
  });

  if (!user || Date.now() - user.createdAt.getTime() > RETRY_WINDOW_MS) {
    return { status: "kept" };
  }

  await deleteUnderageAccount(session.user.id);

  return { status: "accountDeleted" };
}
