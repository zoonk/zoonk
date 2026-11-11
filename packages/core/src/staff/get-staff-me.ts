import "server-only";
import { prisma } from "@zoonk/db";
import { staffRead } from "./read";

export function getStaffMe() {
  return staffRead({
    call: { verb: "me" },
    run: async ({ userId }) => {
      const user = await prisma.user.findUniqueOrThrow({
        select: { email: true, id: true, name: true, role: true },
        where: { id: userId },
      });

      return { data: { user }, rows: 1 };
    },
  });
}
