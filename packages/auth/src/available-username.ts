import { randomInt } from "node:crypto";
import { prisma } from "@zoonk/db";
import { suggestUsername } from "./username-rules";
import { isUsernameAllowed } from "./username-validator";

const USERNAME_SUFFIX_TRIES = 3;
const USERNAME_SUFFIX_RANGE = 10_000;

function getUsernameSuffix(): string {
  return String(randomInt(USERNAME_SUFFIX_RANGE));
}

/** Another account can take the name before it's saved, so the save stays authoritative. */
export async function findAvailableUsername(email: string): Promise<string | null> {
  const candidates = [
    suggestUsername({ email }),
    ...Array.from({ length: USERNAME_SUFFIX_TRIES }, () =>
      suggestUsername({ email, suffix: getUsernameSuffix() }),
    ),
  ].filter((candidate) => isUsernameAllowed(candidate));

  const taken = await prisma.user.findMany({
    select: { username: true },
    where: { username: { in: candidates } },
  });

  const takenUsernames = new Set(taken.map((user) => user.username));

  return candidates.find((candidate) => !takenUsernames.has(candidate)) ?? null;
}
