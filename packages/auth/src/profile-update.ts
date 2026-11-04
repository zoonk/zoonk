import { z } from "zod";

/** Everything a learner may change on their own account; Better Auth's update endpoint refuses the rest. */
export const profileUpdateSchema = z.strictObject({
  name: z.string().optional(),
  username: z.string().optional(),
});

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
