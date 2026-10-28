import "server-only";
import { prisma } from "@zoonk/db";

/** Names are read only to exclude them from outgoing web searches. */
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
