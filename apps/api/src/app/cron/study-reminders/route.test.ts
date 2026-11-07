import { studyReminderWorkflow } from "@/workflows/reminders/study-reminder-workflow";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { POST as deliverScheduledRun } from "./route";

function deliver(headers: Record<string, string>) {
  return deliverScheduledRun(
    new Request("http://localhost/cron/study-reminders", { headers, method: "POST" }),
  );
}

describe("POST /cron/study-reminders", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts a reminder run for each learner whose reminder is due", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-07T19:05:00Z"));

    const user = await userFixture();

    await prisma.studyReminder.create({
      data: { emailOn: true, locale: "en", time: "19:00", userId: user.id },
    });

    vi.mocked(start).mockResolvedValue({ runId: "wrun_reminder" } as Awaited<
      ReturnType<typeof start>
    >);

    const response = await deliver({ "ce-id": "execution-1" });

    expect(response.status).toBe(202);
    expect(start).toHaveBeenCalledWith(studyReminderWorkflow, [{ userId: user.id }]);
  });

  it("starts nothing for a request that isn't a scheduled run", async () => {
    const response = await deliver({});

    expect(response.status).toBe(400);
    expect(start).not.toHaveBeenCalled();
  });
});
