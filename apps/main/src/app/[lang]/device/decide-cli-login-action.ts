"use server";

import { decideCliLogin } from "@zoonk/core/staff/cli-login";
import { z } from "zod";

const decisionSchema = z.object({
  decision: z.enum(["approve", "deny"]),
  userCode: z.string(),
});

export async function decideCliLoginAction(input: z.input<typeof decisionSchema>) {
  const parsed = decisionSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "notFound" } as const;
  }

  return decideCliLogin(parsed.data);
}
