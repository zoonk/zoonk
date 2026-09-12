import { learningProfileInputSchema } from "@zoonk/core/users/learning-profile-contract";
import { z } from "zod";

export const learningProfileUpdateSchema = learningProfileInputSchema.meta({
  description: "Replace the current learner's global interests. An empty list clears them.",
  id: "LearningProfileUpdate",
});

export const learningProfileResponseSchema = z
  .object({ interests: z.array(z.string()) })
  .meta({ id: "LearningProfileResponse" });
