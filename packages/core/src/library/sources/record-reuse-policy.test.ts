import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { describe, expect, it } from "vitest";
import { recordReusePolicy } from "./record-reuse-policy";
import { type ReusePolicy } from "./source-contract";

const READ_POLICY: ReusePolicy = {
  basis: "The notice says past papers may be reproduced with credit.",
  honorTakedowns: true,
  pastQuestions: "allowedWithCitation",
  termsUrl: null,
};

describe(recordReusePolicy, () => {
  it("stores the terms research read, pointing at the source when they name no page", async () => {
    const source = await sourceFixture();

    await expect(recordReusePolicy({ policy: READ_POLICY, sourceId: source.id })).resolves.toBe(
      true,
    );

    const stored = await prisma.source.findUniqueOrThrow({ where: { id: source.id } });
    expect(stored.reusePolicy).toStrictEqual({ ...READ_POLICY, termsUrl: source.url });
  });

  it("keeps a policy already on the source, since a board checked by hand is stronger evidence", async () => {
    const checked: ReusePolicy = {
      basis: "Checked with the board by hand.",
      honorTakedowns: true,
      pastQuestions: "notAllowed",
      termsUrl: "https://example.test/terms",
    };

    const source = await sourceFixture({ reusePolicy: checked });

    await expect(recordReusePolicy({ policy: READ_POLICY, sourceId: source.id })).resolves.toBe(
      false,
    );

    const stored = await prisma.source.findUniqueOrThrow({ where: { id: source.id } });
    expect(stored.reusePolicy).toStrictEqual(checked);
  });

  it("does nothing for a source that no longer exists", async () => {
    await expect(recordReusePolicy({ policy: READ_POLICY, sourceId: randomUUID() })).resolves.toBe(
      false,
    );
  });
});
