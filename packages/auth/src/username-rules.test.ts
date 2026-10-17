import { describe, expect, it } from "vitest";
import { USERNAME_MAX_LENGTH, isUsernameSyntaxValid, suggestUsername } from "./username-rules";

describe(suggestUsername, () => {
  it("turns the email's name part into a valid username", () => {
    expect(suggestUsername({ email: "Ana.Souza+enem@zoonk.test" })).toBe("ana_souza_enem");
    expect(suggestUsername({ email: "joão-çá@zoonk.test" })).toBe("joao_ca");
  });

  it("falls back to a neutral name when the email's name part is too short", () => {
    expect(suggestUsername({ email: "a@zoonk.test" })).toBe("learner");
    expect(suggestUsername({ email: "..@zoonk.test" })).toBe("learner");
  });

  it("adds a suffix within the length limit", () => {
    const long = `${"a".repeat(40)}@zoonk.test`;
    const username = suggestUsername({ email: long, suffix: "4821" });

    expect(username).toHaveLength(USERNAME_MAX_LENGTH);
    expect(username.endsWith("_4821")).toBe(true);
    expect(suggestUsername({ email: "ana@zoonk.test", suffix: "07" })).toBe("ana_07");
  });

  it("always suggests a username the rules accept", () => {
    const emails = ["Ana@zoonk.test", "x@y.z", `${"é".repeat(50)}@zoonk.test`, "_a_b_@zoonk.test"];

    for (const email of emails) {
      expect(isUsernameSyntaxValid(suggestUsername({ email }))).toBe(true);
      expect(isUsernameSyntaxValid(suggestUsername({ email, suffix: "1234" }))).toBe(true);
    }
  });
});
