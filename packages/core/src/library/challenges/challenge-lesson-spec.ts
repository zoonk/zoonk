import { type CourseLevel } from "@zoonk/db";
import { z } from "zod";
import { CHALLENGE_VARIANTS } from "../steps/contract/challenge-content";

/**
 * `Lesson.spec` of a chapter's challenge: which kind of case to write and the chapter skills it
 * trains. Regular lessons store a screen plan instead, so the writer can tell them apart.
 */
const challengeLessonSpecSchema = z.object({
  kind: z.literal("challenge"),
  skills: z.array(z.object({ description: z.string().nullable(), name: z.string().min(1) })).min(1),
  variant: z.enum(CHALLENGE_VARIANTS),
});

export type ChallengeLessonSpec = z.infer<typeof challengeLessonSpecSchema>;

/** Overview courses get a light "What if"; every other level a case solved like at work. */
export function getChallengeVariant(level: CourseLevel): ChallengeLessonSpec["variant"] {
  return level === "overview" ? "whatIf" : "work";
}

/** The stored spec when the lesson is a challenge, or null for any other lesson. */
export function parseChallengeLessonSpec(spec: unknown): ChallengeLessonSpec | null {
  const parsed = challengeLessonSpecSchema.safeParse(spec);
  return parsed.success ? parsed.data : null;
}

/** A challenge's identity is its chapter's (`challenge:<chapterId>`, owner-scoped when private). */
const CHALLENGE_IDENTITY_PATTERN = /(?:^|:)challenge:[\da-f-]{36}$/u;

/**
 * Whether a lesson is a chapter's challenge, from its identity key alone, so plans can leave
 * challenges out without reading every lesson's spec.
 */
export function isChallengeIdentityKey(identityKey: string): boolean {
  return CHALLENGE_IDENTITY_PATTERN.test(identityKey);
}
