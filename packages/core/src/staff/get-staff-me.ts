import "server-only";
import { prisma } from "@zoonk/db";
import { getStaffActor } from "./get-staff-actor";

export async function getStaffMe() {
  const actor = await getStaffActor();

  if (actor.status !== "ready") {
    return actor;
  }

  const user = await prisma.user.findUniqueOrThrow({
    select: { email: true, id: true, name: true, role: true },
    where: { id: actor.userId },
  });

  return { status: "ready", user } as const;
}
