import { type Page } from "@playwright/test";
import { LIVE_CALL_GRACE_SECONDS } from "@zoonk/core/entitlements/limits";
import { prisma } from "@zoonk/db";
import { expect } from "./fixtures";

const MS_PER_SECOND = 1000;

/** Checks the displayed clock against its real reservation and the fake peer's browser start. */
export async function expectCallClock({
  allowanceSeconds,
  conversationId,
  getStartedAt,
  page,
}: {
  allowanceSeconds: number;
  conversationId: string;
  getStartedAt: () => Promise<number | null>;
  page: Page;
}) {
  const clock = page.getByText(/^\d+:\d{2} \/ \d+:\d{2}$/u);
  await expect(clock).toBeVisible();

  const [text, startedAt, connection] = await Promise.all([
    clock.textContent(),
    getStartedAt(),
    prisma.liveCallConnection.findFirstOrThrow({
      orderBy: { attemptNumber: "desc" },
      where: { conversationId },
    }),
  ]);

  const parsed =
    /^(?<elapsedMinutes>\d+):(?<elapsedSeconds>\d{2}) \/ (?<limitMinutes>\d+):(?<limitSeconds>\d{2})$/u.exec(
      text ?? "",
    )?.groups;

  if (!parsed || startedAt === null) {
    throw new Error("A live call must have a clock and an observed peer start.");
  }

  const elapsed = Number(parsed.elapsedMinutes) * 60 + Number(parsed.elapsedSeconds);
  const limit = Number(parsed.limitMinutes) * 60 + Number(parsed.limitSeconds);

  const deadlineSeconds = Math.round(
    (connection.deadlineAt.getTime() - LIVE_CALL_GRACE_SECONDS * MS_PER_SECOND - startedAt) /
      MS_PER_SECOND,
  );

  const remaining = Math.max(0, Math.min(connection.heldSeconds, deadlineSeconds));

  expect(connection.heldSeconds).toBe(allowanceSeconds);
  expect(elapsed).toBeGreaterThanOrEqual(0);
  expect(elapsed).toBeLessThan(10);
  expect(limit).toBeLessThanOrEqual(remaining);

  // Core floors remaining reply seconds; the browser then rounds its displayed duration.
  expect(limit).toBeGreaterThanOrEqual(Math.max(0, remaining - 1));
}
