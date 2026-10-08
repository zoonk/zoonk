import {
  type CourseExtensionRequest,
  listSkillExtensions,
} from "@zoonk/core/library/curriculum/skill-extensions";

export async function listSkillExtensionsStep(input: {
  goalId: string;
  timeZone: string;
}): Promise<CourseExtensionRequest[]> {
  "use step";

  return listSkillExtensions(input);
}
