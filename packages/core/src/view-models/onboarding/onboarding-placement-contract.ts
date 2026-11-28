import { z } from "zod";
import { focusTestOfferSchema } from "../../learner/placement/focus-test-contract";
import { coursePlacementOfferSchema } from "../../learner/placement/placement-contract";

export const onboardingPlacementSchema = z
  .object({
    mode: z.enum(["offer", "direct", "resume"]),
    test: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("course"), offer: coursePlacementOfferSchema.nullable() }),
      z.object({ kind: z.literal("focus"), offer: focusTestOfferSchema.nullable() }),
      z.object({ kind: z.literal("language") }),
    ]),
  })
  .meta({ id: "OnboardingPlacement" });

export type OnboardingPlacement = z.infer<typeof onboardingPlacementSchema>;
