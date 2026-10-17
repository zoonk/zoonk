import { planWatchSchema } from "@zoonk/core/plans/changed-since-contract";
import { z } from "zod";

/** The read a screen waiting on lessons asks about: when it read, and what it watches. */
export const planChangedSinceQuerySchema = z
  .object({
    since: z.iso
      .datetime({ offset: true })
      .meta({
        description:
          "When the client read the plan or Today, in the server's time (such as that response's Date header), not the device's. Writes up to two seconds before it still count, so none is missed",
      }),
    watch: planWatchSchema.default("plan"),
  })
  .meta({ id: "PlanChangedSinceQuery" });
