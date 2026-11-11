import "server-only";
import { prisma } from "@zoonk/db";
import { getStaffActor } from "./get-staff-actor";
import { type StaffResult } from "./read";

type StaffMember = { email: string; id: string; name: string; role: string | null };

export async function getStaffMe(): Promise<StaffResult<{ user: StaffMember }>> {
  const actor = await getStaffActor();

  if (actor.status !== "ready") {
    return { status: actor.status };
  }

  const user = await prisma.user.findUniqueOrThrow({
    select: { email: true, id: true, name: true, role: true },
    where: { id: actor.userId },
  });

  return { status: "ready", user };
}
