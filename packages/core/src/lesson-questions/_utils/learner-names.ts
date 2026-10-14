import "server-only";
import { prisma } from "@zoonk/db";

/**
 * The names a learner goes by in the app: their account's display name, username and email's
 * local part, and their buddy's name. The buddy's web search reads them only to keep each one out
 * of what it sends (in any written form), the way it keeps their memory's words out.
 */
export async function loadLearnerNames(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    select: {
      displayUsername: true,
      email: true,
      learningProfile: { select: { buddyName: true } },
      name: true,
      username: true,
    },
    where: { id: userId },
  });

  if (!user) {
    return [];
  }

  const [emailName] = user.email.split("@");

  return [
    user.name,
    user.username,
    user.displayUsername,
    emailName,
    user.learningProfile?.buddyName,
  ].filter((name): name is string => Boolean(name));
}
