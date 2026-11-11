import { describe, expect, it, vi } from "vitest";
import { formatExamIdentityInput } from "./exam-identity-decision";

vi.mock("server-only", () => ({}));
vi.mock("./exam-identity-decision.prompt.md", () => ({ default: "" }));

describe(formatExamIdentityInput, () => {
  it("keeps a request's unknown country unknown beside a candidate's known one", () => {
    const input = formatExamIdentityInput({
      candidate: { board: "INEP", country: "BR", name: "ENEM", role: null },
      request: { board: null, country: null, name: "ENEM", role: null },
    });

    expect(JSON.parse(input.REQUEST)).toStrictEqual({
      board: null,
      country: null,
      name: "ENEM",
      role: null,
    });

    expect(JSON.parse(input.CANDIDATE)).toMatchObject({ country: "BR" });
  });
});
