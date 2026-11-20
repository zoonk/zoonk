import { randomUUID } from "node:crypto";
import { studySessionSummaryVisitSchema } from "@zoonk/core/sessions/summary-visit-contract";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { mockAccountSession } from "../../../../../../../../../packages/core/src/_test-utils/mock-session";
import { GET as readSummary } from "../route";
import { POST as createVisit } from "./route";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

describe("study session summary visits", () => {
  it("lets the first POST claim the day after GET and keeps the result on retry", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    const session = await studySessionFixture({
      goalId: goal.id,
      status: "completed",
      userId: user.id,
    });

    await studySessionBlockFixture({ sessionId: session.id, status: "completed" });
    mockAccountSession({ user });

    const context = { params: Promise.resolve({ sessionId: session.id }) };
    const url = `http://localhost/v1/study-sessions/${session.id}/summary`;
    const visitId = randomUUID();
    const read = await readSummary(new Request(`${url}?timeZone=UTC`), context);
    expect(read.status).toBe(200);

    async function visit(id: string) {
      const response = await createVisit(
        new NextRequest(`${url}/visit`, { body: JSON.stringify({ visitId: id }), method: "POST" }),
        context,
      );

      expect(response.status).toBe(200);
      return studySessionSummaryVisitSchema.parse(await response.json());
    }

    await expect(visit(visitId)).resolves.toStrictEqual({ first: true });
    await expect(visit(visitId.toUpperCase())).resolves.toStrictEqual({ first: true });
    await expect(visit(randomUUID())).resolves.toStrictEqual({ first: false });
  });
});
