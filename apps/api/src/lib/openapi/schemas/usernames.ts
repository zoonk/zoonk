import {
  USERNAME_ALLOWED_CHARACTERS,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  normalizeUsername,
} from "@zoonk/auth/username-rules";
import { z } from "zod";

export const usernameCandidateSchema = z
  .string()
  .trim()
  .min(USERNAME_MIN_LENGTH)
  .max(USERNAME_MAX_LENGTH)
  .regex(USERNAME_ALLOWED_CHARACTERS, "Username contains unsupported characters")
  .transform(normalizeUsername)
  .meta({ description: "Normalized username candidate" });

export const usernameAvailabilityPathSchema = z
  .object({ username: usernameCandidateSchema })
  .meta({ id: "UsernameAvailabilityPath" });

export const usernameAvailabilityResponseSchema = z
  .object({
    isAvailable: z
      .boolean()
      .meta({
        description:
          "Whether the username currently passes the reserved-name and uniqueness policies",
      }),
    username: z.string().meta({ description: "Normalized username candidate" }),
  })
  .meta({ id: "UsernameAvailabilityResponse" });
