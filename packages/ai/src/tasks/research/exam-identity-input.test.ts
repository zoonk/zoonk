import { describe, expect, it } from "vitest";
import { formatExamIdentityInput } from "./exam-identity-input";

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
