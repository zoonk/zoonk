import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockAccountSession } from "../../../../../../../../packages/core/src/_test-utils/mock-session";
import { POST as answer } from "./route";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

function answerTools(picks: string[]) {
  return answer(
    new Request("http://localhost/v1/me/profile-questions/answers", {
      body: JSON.stringify({ answer: { picks }, question: "tools" }),
      method: "POST",
    }),
  );
}

describe("POST /v1/me/profile-questions/answers", () => {
  it("saves stale option ids and names after the list changes", async () => {
    const user = await userFixture();
    mockAccountSession({ user });
    await learningProfileFixture({ suggestedTools: ["Whitebook"], userId: user.id });

    const response = await answerTools(["excel", " Tasy ", "Tasy"]);

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toMatchObject({
      question: {
        options: [
          { id: "Whitebook", label: "Whitebook" },
          { id: "Tasy", label: "Tasy" },
          { id: "excel", label: "Excel" },
        ],
        saved: { picks: ["Tasy", "excel"] },
      },
    });
  });

  it("refuses an answer containing an overlong tool name", async () => {
    const response = await answerTools(["x".repeat(121)]);
    expect(response.status).toBe(422);
  });
});
