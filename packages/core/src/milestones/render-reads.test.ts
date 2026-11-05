import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { signedInCourseGoal } from "../view-models/_test-utils/course-goal";
import { getBuddyStatus } from "./get-buddy-status";
import { getWeeklyRecap } from "./get-weekly-recap";

describe("buddy render reads", () => {
  it.each([
    ["buddy", getBuddyStatus],
    ["weekly recap", getWeeklyRecap],
  ] as const)("reads %s without writing", async (_name, read) => {
    await signedInCourseGoal();
    const counts = await countDatabaseStatements(async () => read({}));
    expect(counts.writes).toBe(0);
    expect(counts.result.status).toBe("ready");
  });
});
