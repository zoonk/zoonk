import { describe, expect, it } from "vitest";
import { buildExamIdentityKey } from "./exam-identity";

describe("exam country identity", () => {
  it("keeps same-named exams from different countries separate", () => {
    const shared = { name: "National exam", ownerId: null, role: null };

    expect(buildExamIdentityKey({ ...shared, country: "PT" })).not.toBe(
      buildExamIdentityKey({ ...shared, country: "BR" }),
    );
  });

  it("keeps the private owner prefix first", () => {
    expect(
      buildExamIdentityKey({ country: "PT", name: "Exam", ownerId: "learner", role: null }),
    ).toBe("private:learner:PT:exam");
  });
});
