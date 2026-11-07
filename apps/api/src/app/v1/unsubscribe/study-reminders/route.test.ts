import { signStudyReminderUnsubscribeToken } from "@zoonk/core/reminders/email-unsubscribe";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MAIN_URL } from "@zoonk/utils/url";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET as openPage, POST as unsubscribe } from "./route";

async function subscribedLearner() {
  const user = await userFixture();

  await prisma.studyReminder.create({
    data: { emailOn: true, locale: "en", time: "19:00", userId: user.id },
  });

  return { token: signStudyReminderUnsubscribeToken(user.id), user };
}

function request(token: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  const url = `http://localhost/v1/unsubscribe/study-reminders?token=${encodeURIComponent(token)}`;
  return new NextRequest(url, init);
}

function oneClick(token: string) {
  return request(token, {
    body: "List-Unsubscribe=One-Click",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
}

async function emailOn(userId: string) {
  const reminder = await prisma.studyReminder.findUniqueOrThrow({ where: { userId } });
  return reminder.emailOn;
}

describe("/v1/unsubscribe/study-reminders", () => {
  it("turns email off on the mailbox's one-click POST, without a redirect, every time", async () => {
    const { token, user } = await subscribedLearner();

    const first = await unsubscribe(oneClick(token));

    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toStrictEqual({ emailOn: false });
    expect(first.headers.get("Cache-Control")).toBe("no-store");
    await expect(emailOn(user.id)).resolves.toBe(false);

    const repeat = await unsubscribe(oneClick(token));
    expect(repeat.status).toBe(200);
  });

  it("opens Main's page on GET and changes nothing", async () => {
    const { token, user } = await subscribedLearner();

    const response = await openPage(request(token));

    expect(response.status).toBe(303);

    expect(response.headers.get("Location")).toBe(
      `${MAIN_URL}/study-reminders/unsubscribe?token=${encodeURIComponent(token)}`,
    );

    await expect(emailOn(user.id)).resolves.toBe(true);
  });

  it("refuses a forged token", async () => {
    const { user } = await subscribedLearner();

    const response = await unsubscribe(oneClick(`${user.id}.forged`));

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_UNSUBSCRIBE_TOKEN" },
    });

    await expect(emailOn(user.id)).resolves.toBe(true);
  });
});
