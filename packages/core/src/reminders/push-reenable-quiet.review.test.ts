import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockAccountSession } from "../_test-utils/mock-session";
import { selectStudyReminderPhone } from "./study-reminder-phone";
import { updateStudyReminder } from "./update-study-reminder";

async function signIn(user: Awaited<ReturnType<typeof userFixture>>) {
  const session = await prisma.session.create({
    data: { expiresAt: new Date("2099-01-01"), token: randomUUID(), userId: user.id },
  });

  mockAccountSession({ sessionId: session.id, user });
  return session;
}

describe("turning push back on after signing out of the phone", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["deleted", "expired"] as const)(
    "restarts the 7 quiet days after the phone's session is %s",
    async (state) => {
      const user = await userFixture();

      const device = {
        label: "Pixel",
        locale: "en" as const,
        platform: "android" as const,
        token: `fid-${randomUUID()}`,
      };

      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
      const first = await signIn(user);
      await selectStudyReminderPhone(device);
      await updateStudyReminder({ locale: "en", pushOn: true });

      if (state === "deleted") {
        await prisma.session.delete({ where: { id: first.id } });
      } else {
        await prisma.session.update({
          data: { expiresAt: new Date("2026-10-02T12:00:00Z") },
          where: { id: first.id },
        });
      }

      vi.setSystemTime(new Date("2026-11-07T12:00:00Z"));
      await signIn(user);

      await expect(updateStudyReminder({ locale: "en", pushOn: true })).resolves.toStrictEqual({
        status: "phoneRequired",
      });

      await selectStudyReminderPhone(device);

      await expect(updateStudyReminder({ locale: "en", pushOn: true })).resolves.toMatchObject({
        reminder: { push: { on: true }, quiet: false },
        status: "updated",
      });

      await expect(
        prisma.studyReminder.findUniqueOrThrow({ where: { userId: user.id } }),
      ).resolves.toMatchObject({ enabledAt: new Date("2026-11-07T12:00:00Z") });

      vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));

      await expect(
        selectStudyReminderPhone({ ...device, token: `fid-${randomUUID()}` }),
      ).resolves.toMatchObject({ reminder: { quiet: true } });

      await expect(
        prisma.studyReminder.findUniqueOrThrow({ where: { userId: user.id } }),
      ).resolves.toMatchObject({ enabledAt: new Date("2026-11-07T12:00:00Z") });
    },
  );
});
