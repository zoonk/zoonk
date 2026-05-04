import { describe, expect, it } from "vitest";
import { getNumber } from "./json";

describe(getNumber, () => {
  it("reads a numeric property from an unknown object", () => {
    expect(getNumber({ statusCode: 401 }, "statusCode")).toBe(401);
  });

  it("reads a numeric string property from an unknown object", () => {
    expect(getNumber({ statusCode: "401" }, "statusCode")).toBe(401);
  });

  it("returns null when a string property is not numeric", () => {
    expect(getNumber({ statusCode: "not-found" }, "statusCode")).toBeNull();
  });

  it("returns null when a string property is empty", () => {
    expect(getNumber({ statusCode: " " }, "statusCode")).toBeNull();
  });

  it("returns null when the input is not an object", () => {
    expect(getNumber(null, "statusCode")).toBeNull();
  });
});
