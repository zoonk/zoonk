import { type CourseLevel } from "@zoonk/db";
import { z } from "zod";
import { CHALLENGE_VARIANTS } from "../steps/contract/challenge-content";

const challengeLessonSpecSchema = z.object({
  kind: z.literal("challenge"),
  skills: z.array(z.object({ description: z.string().nullable(), name: z.string().min(1) })).min(1),
  variant: z.enum(CHALLENGE_VARIANTS),
});

export type ChallengeLessonSpec = z.infer<typeof challengeLessonSpecSchema>;

export function getChallengeVariant(level: CourseLevel): ChallengeLessonSpec["variant"] {
  return level === "overview" ? "whatIf" : "work";
}

export function parseChallengeLessonSpec(spec: unknown): ChallengeLessonSpec | null {
  const parsed = challengeLessonSpecSchema.safeParse(spec);
  return parsed.success ? parsed.data : null;
}

const CHALLENGE_IDENTITY_PATTERN = /(?:^|:)challenge:[\da-f-]{36}$/u;

export function isChallengeIdentityKey(identityKey: string): boolean {
  return CHALLENGE_IDENTITY_PATTERN.test(identityKey);
}
