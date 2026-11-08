import { userFixture } from "@zoonk/testing/fixtures/users";
import { mergeSkillForAdmin } from "../library/skills/merge-skill";
import { mockAdminSession } from "./mock-session";

/** Leaves the admin signed in, so a learner's capability called next needs its session back. */
export async function mergeSkills(skills: { duplicateId: string; survivorId: string }) {
  const admin = await userFixture({ role: "admin" });
  mockAdminSession(admin.id);

  const merged = await mergeSkillForAdmin(skills);

  if (merged.status !== "merged") {
    throw new Error(`Expected the merge to succeed, not ${merged.status}`);
  }
}
