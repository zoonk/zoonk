import { describe, expect, it } from "vitest";
import { NAME_MAX_LENGTH, isNameChangeTooLong } from "./name-rules";

describe(isNameChangeTooLong, () => {
  const longestName = "a".repeat(NAME_MAX_LENGTH);

  it("refuses a new name past the limit and accepts one at it", () => {
    expect(isNameChangeTooLong({ name: `${longestName}a`, savedName: "Ana" })).toBe(true);
    expect(isNameChangeTooLong({ name: longestName, savedName: "Ana" })).toBe(false);
  });

  it("keeps a name saved before the limit until it changes", () => {
    const savedName = ` ${"a".repeat(NAME_MAX_LENGTH + 50)} `;

    expect(isNameChangeTooLong({ name: savedName.trim(), savedName })).toBe(false);
    expect(isNameChangeTooLong({ name: savedName.slice(2), savedName })).toBe(true);
  });

  it("counts characters as code points, as the API's maxLength does", () => {
    const astral = "\u{20000}";

    expect(isNameChangeTooLong({ name: astral.repeat(NAME_MAX_LENGTH), savedName: "Ana" })).toBe(
      false,
    );

    expect(
      isNameChangeTooLong({ name: astral.repeat(NAME_MAX_LENGTH + 1), savedName: "Ana" }),
    ).toBe(true);
  });

  it("counts the name without its surrounding spaces", () => {
    expect(isNameChangeTooLong({ name: ` ${longestName} `, savedName: "Ana" })).toBe(false);
  });
});
