import "server-only";
import { prisma } from "@zoonk/db";
import { z } from "zod";
import { type StaffResult, staffRead } from "./read";

type StaffMember = { email: string; id: string; name: string; role: string | null };

export function getStaffMe(): Promise<StaffResult<{ user: StaffMember }>> {
  return staffRead({
    call: { verb: "me" },
    input: {},
    run: async (_input, actor) => ({
      data: {
        user: await prisma.user.findUniqueOrThrow({
          select: { email: true, id: true, name: true, role: true },
          where: { id: actor.userId },
        }),
      },
      rows: 1,
    }),
    schema: z.object({}),
  });
}
