import { z } from "zod";

const MAX_TRACK_TITLE_LENGTH = 160;

const trackCourseIdsSchema = z
  .array(z.uuid())
  .min(1)
  .refine((ids) => new Set(ids).size === ids.length);
export const trackInputSchema = z
  .object({
    courseIds: trackCourseIdsSchema,
    title: z.string().trim().min(1).max(MAX_TRACK_TITLE_LENGTH),
  })
  .strict();
const trackMemberSchema = z.union([
  z.object({ courseId: z.uuid() }).strict(),
  z.object({ coursePromptId: z.uuid() }).strict(),
]);
export const trackUpdateSchema = trackInputSchema
  .partial()
  .extend({
    members: z
      .array(trackMemberSchema)
      .min(1)
      .refine(
        (members) =>
          new Set(
            members.map((member) =>
              "courseId" in member
                ? `course:${member.courseId}`
                : `prompt:${member.coursePromptId}`,
            ),
          ).size === members.length,
      )
      .optional(),
  })
  .refine((input) => Object.keys(input).length > 0 && !(input.courseIds && input.members));
export type TrackInput = z.infer<typeof trackInputSchema>;
export type TrackUpdateInput = z.infer<typeof trackUpdateSchema>;
