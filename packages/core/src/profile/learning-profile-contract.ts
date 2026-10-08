import { BuddyGlasses, BuddyKind } from "@zoonk/db";
import { type AgeGroup, isValidBirthMonthYear } from "@zoonk/utils/age";
import { z } from "zod";
import { dailyLimitMinutesSchema } from "../minors/guardian/guardian-contract";

const BUDDY_NAME_MAX_LENGTH = 24;
const FIRST_MONTH = 1;
const LAST_MONTH = 12;

const buddyInputSchema = z
  .object({
    glasses: z
      .enum(BuddyGlasses)
      .optional()
      .meta({ description: "Round comes with the buddy; the others must be earned first" }),
    kind: z.enum(BuddyKind).meta({ description: "Which buddy" }),
    name: z
      .string()
      .trim()
      .min(1)
      .max(BUDDY_NAME_MAX_LENGTH)
      .nullable()
      .optional()
      .meta({ description: "A custom name, or null to use the buddy's own name" }),
  })
  .strict()
  .meta({ id: "BuddyInput" });

const birthInputSchema = z
  .object({
    month: z.int().min(FIRST_MONTH).max(LAST_MONTH).meta({ description: "Birth month, 1 to 12" }),
    year: z.int().meta({ description: "Birth year" }),
  })
  .strict()
  .refine(({ month, year }) => isValidBirthMonthYear({ birthMonth: month, birthYear: year }), {
    message: "Birth month and year must be a real date that isn't in the future",
  })
  .meta({ id: "BirthMonthYearInput" });

function hasProfileField(input: Record<string, unknown>) {
  return Object.values(input).some((value) => value !== undefined);
}

/** Every field is optional so each screen (onboarding, Appearance, the tabs) sends only what changed. */
export const learningProfileUpdateSchema = z
  .object({
    activeGoalId: z
      .uuid()
      .nullable()
      .optional()
      .meta({ description: "The goal the tabs show, or null for none" }),
    birth: birthInputSchema.optional(),
    buddy: buddyInputSchema
      .nullable()
      .optional()
      .meta({ description: "The learner's buddy, or null to remove it" }),
    dailyLimitMinutes: dailyLimitMinutesSchema
      .optional()
      .meta({ description: "The learner's own daily study limit; a guardian's can be stricter" }),
    soundsEnabled: z
      .boolean()
      .optional()
      .meta({ description: "Sounds for a right answer and for finishing" }),
  })
  .strict()
  .refine(hasProfileField, { message: "At least one profile field must be provided" })
  .meta({ id: "LearningProfileUpdate", override: { minProperties: 1 } });

export type LearningProfileUpdateInput = z.infer<typeof learningProfileUpdateSchema>;

/** What every screen and the API read about a learner's profile. */
export type LearningProfileView = {
  activeGoalId: string | null;
  ageGroup: AgeGroup;
  availableGlasses: BuddyGlasses[];
  birth: { month: number; year: number } | null;
  /** The learner's own daily limit in minutes; a guardian's stricter limit still applies. */
  dailyLimitMinutes: number | null;
  buddy: { glasses: BuddyGlasses; kind: BuddyKind; name: string | null } | null;
  /** On until the learner turns them off in Appearance. */
  soundsEnabled: boolean;
};
