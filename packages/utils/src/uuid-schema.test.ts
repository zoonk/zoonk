import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { uuidSchema } from "./uuid-schema";

describe(uuidSchema, () => {
  it("reads a UUID in any case as lowercase", () => {
    const id = randomUUID();

    expect(uuidSchema().parse(id.toUpperCase())).toBe(id);
    expect(uuidSchema().parse(`${id.slice(0, 18)}${id.slice(18).toUpperCase()}`)).toBe(id);
    expect(uuidSchema().parse(id)).toBe(id);
  });

  it("refuses what isn't a UUID", () => {
    expect(uuidSchema().safeParse("not-a-uuid").success).toBe(false);
    expect(uuidSchema().safeParse(` ${randomUUID()} `).success).toBe(false);
  });
});
