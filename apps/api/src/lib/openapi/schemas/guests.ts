import { z } from "zod";

export const guestSessionResponseSchema = z
  .object({ token: z.string().min(1).meta({ description: "Guest bearer session token" }) })
  .meta({ id: "GuestSessionResponse" });
