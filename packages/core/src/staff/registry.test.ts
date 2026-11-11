import { databaseSchema } from "@zoonk/db/schema";
import { assert, bigInt, property } from "fast-check";
import { describe, expect, it } from "vitest";
import { staffCredentialPolicy } from "./policy";
import { describeModels, readableFields } from "./registry";
import { serializeStaffValue } from "./serialize";

const { excludedModels, reviewedFields, strippedFields } = staffCredentialPolicy;

describe("staff registry", () => {
  it("includes OAuth token, secret and device-code columns in its DMMF review", () => {
    const credentials = databaseSchema.models.flatMap((model) =>
      model.fields
        .filter((field) => field.kind !== "object" && /token|secret|code/iu.test(field.name))
        .map((field) => `${model.name}.${field.name}`),
    );

    expect(credentials).toStrictEqual(
      expect.arrayContaining([
        "OauthClient.clientSecret",
        "OauthRefreshToken.token",
        "OauthAccessToken.token",
        "DeviceCode.deviceCode",
        "DeviceCode.userCode",
      ]),
    );
  });

  it("requires a credential review for every suspicious scalar in the Prisma DMMF", () => {
    const unreviewed = databaseSchema.models.flatMap((model) => {
      if (excludedModels.includes(model.name)) {
        return [];
      }

      return model.fields
        .filter(
          (field) =>
            field.kind !== "object" &&
            /token|secret|password|key|hash|code|otp|credential/iu.test(field.name) &&
            !strippedFields[model.name]?.includes(field.name) &&
            !reviewedFields[model.name]?.includes(field.name),
        )
        .map((field) => `${model.name}.${field.name}`);
    });

    expect(unreviewed).toStrictEqual([]);
  });

  it("describes readable scalar types, nullability, lists and enum values", () => {
    const models = describeModels();

    for (const model of excludedModels) {
      expect(models.map((entry) => entry.name)).not.toContain(model);
    }

    expect(models.find((model) => model.name === "User")?.fields).toStrictEqual(
      expect.arrayContaining([
        { isList: false, isOptional: false, name: "id", type: "String" },
        { isList: false, isOptional: true, name: "username", type: "String" },
      ]),
    );

    const session = models.find((model) => model.name === "Session");
    expect(session?.fields.map((field) => field.name)).not.toContain("token");
    expect(session).not.toHaveProperty("relations");

    expect(models.find((model) => model.name === "FollowUp")?.fields).toContainEqual(
      expect.objectContaining({ name: "kind", values: expect.arrayContaining(["prepareSession"]) }),
    );

    for (const model of databaseSchema.models) {
      for (const field of strippedFields[model.name] ?? []) {
        expect(readableFields(model).map((entry) => entry.name)).not.toContain(field);
      }
    }
  });

  it("serializes runtime values and leaves JSON columns intact", () => {
    expect(
      serializeStaffValue({
        date: new Date("2026-01-02T03:04:05Z"),
        integer: 9_007_199_254_740_993n,
        json: { nested: ["text", null, true, { value: 3 }] },
      }),
    ).toStrictEqual({
      date: "2026-01-02T03:04:05.000Z",
      integer: "9007199254740993",
      json: { nested: ["text", null, true, { value: 3 }] },
    });
  });

  it("serializes nested BigInt values without losing precision", () => {
    assert(
      property(bigInt(), (value) => {
        expect(serializeStaffValue({ nested: [value] })).toStrictEqual({
          nested: [value.toString()],
        });
      }),
    );
  });
});
