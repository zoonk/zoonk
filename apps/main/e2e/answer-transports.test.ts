import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";

/**
 * Answers, grades and recordings go to the app's own routes instead of Server Actions. The session
 * cookie authenticates them, so only the app's own pages may send them.
 */

const ATTACKER_ORIGIN = "https://attacker.example";

test.describe("Answer transports", () => {
  test("refuses answers another site sends with the learner's cookies", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const id = crypto.randomUUID();

    const paths = [
      `/api/steps/${id}/checks`,
      `/api/pronunciation-reviews/${id}/answers`,
      `/api/me/mistakes/${id}/answers`,
      `/api/essays/${id}/submissions`,
      `/api/study-sessions/${id}/blocks/${id}/answers`,
    ];

    const statuses = await Promise.all(
      paths.flatMap((path) => [
        page.request
          .post(path, { data: {}, headers: { Origin: ATTACKER_ORIGIN } })
          .then((response) => response.status()),
        // A request without an Origin isn't a page of this app either.
        page.request.post(path, { data: {} }).then((response) => response.status()),
      ]),
    );

    expect(statuses).toStrictEqual(paths.flatMap(() => [403, 403]));
    await expect(prisma.attempt.count({ where: { userId: noProgressUser.id } })).resolves.toBe(0);
  });
});
