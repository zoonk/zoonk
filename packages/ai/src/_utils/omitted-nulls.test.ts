import { zodSchema } from "ai";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { acceptOmittedNulls } from "./omitted-nulls";

const schema = z.object({
  screens: z.array(
    z.union([
      z.object({ kind: z.literal("text"), note: z.string().nullable(), text: z.string() }),
      z.object({ kind: z.literal("count"), total: z.number() }),
    ]),
  ),
  title: z.string(),
});

describe(acceptOmittedNulls, () => {
  it("reads a key left out as null only where null is a value the key takes", async () => {
    const { validate } = acceptOmittedNulls(schema);

    await expect(
      validate?.({
        screens: [
          { kind: "text", text: "Hi" },
          { kind: "count", total: 2 },
        ],
        title: "A",
      }),
    ).resolves.toStrictEqual({
      success: true,
      value: {
        screens: [
          { kind: "text", note: null, text: "Hi" },
          { kind: "count", total: 2 },
        ],
        title: "A",
      },
    });

    await expect(validate?.({ screens: [{ kind: "count" }], title: "A" })).resolves.toMatchObject({
      success: false,
    });

    await expect(validate?.({ screens: [] })).resolves.toMatchObject({ success: false });
  });

  it("sends models the same schema, with every key required", async () => {
    const sent = await zodSchema(schema).jsonSchema;

    await expect(Promise.resolve(acceptOmittedNulls(schema).jsonSchema)).resolves.toStrictEqual(
      sent,
    );
  });
});
