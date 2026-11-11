import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { databaseSchema } from "@zoonk/db/schema";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { signInStaff, staffRequest } from "./_test-utils/requests";
import { GET as getModels } from "./models/route";
import { POST as countRecords } from "./records/count/route";
import { POST as getRecord } from "./records/get/route";
import { POST as listRecords } from "./records/list/route";

const listResponse = z.object({
  hasMore: z.boolean(),
  records: z.array(z.record(z.string(), z.unknown())),
});

function get(body: unknown) {
  return getRecord(staffRequest({ body, path: "/staff/records/get" }));
}

function list(body: unknown) {
  return listRecords(staffRequest({ body, path: "/staff/records/list" }));
}

function count(body: unknown) {
  return countRecords(staffRequest({ body, path: "/staff/records/count" }));
}

describe("staff record routes", () => {
  it("never exposes credential models in model discovery, get, list or count", async () => {
    await signInStaff();
    const response = await getModels();
    expect(response.status).toBe(200);

    const body = z
      .object({
        models: z.array(
          z.object({
            fields: z.array(z.object({ name: z.string(), values: z.array(z.string()).optional() })),
            name: z.string(),
          }),
        ),
      })
      .parse(await response.json());

    const excluded = databaseSchema.models.filter(
      (model) =>
        model.name.startsWith("Oauth") ||
        ["DeviceCode", "Verification", "RestoreKey", "AppAttestKey"].includes(model.name),
    );

    await Promise.all(
      excluded.map(async (model) => {
        expect(body.models.map((entry) => entry.name)).not.toContain(model.name);

        const responses = await Promise.all([
          get({ id: randomUUID(), model: model.name }),
          list({ model: model.name }),
          count({ model: model.name }),
        ]);

        expect(responses.map((entry) => entry.status)).toStrictEqual([400, 400, 400]);
      }),
    );

    const session = body.models.find((model) => model.name === "Session");
    expect(session?.fields.map((field) => field.name)).not.toContain("token");

    expect(body.models.find((model) => model.name === "FollowUp")?.fields).toContainEqual(
      expect.objectContaining({ name: "kind", values: expect.arrayContaining(["prepareSession"]) }),
    );
  });

  it("strips stored credentials from actual account, session and subscription rows", async () => {
    const { accessToken, user } = await signInStaff();
    const account = await prisma.account.findFirstOrThrow({ where: { userId: user.id } });

    const secrets = ["access", "refresh", "id", "purchase"].map(
      (kind) => `${kind}-${randomUUID()}`,
    );

    await prisma.account.update({
      data: { accessToken: secrets[0], idToken: secrets[2], refreshToken: secrets[1] },
      where: { id: account.id },
    });

    const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });

    const subscription = await prisma.subscription.create({
      data: {
        plan: "plus",
        provider: "google",
        providerSubscriptionId: secrets[3],
        referenceId: user.id,
        status: "active",
        userId: user.id,
      },
    });

    const responses = await Promise.all([
      get({ id: account.id, model: "Account" }),
      list({ model: "Account", where: [{ field: "userId", op: "eq", value: user.id }] }),
      get({ id: session.id, model: "Session" }),
      get({ id: subscription.id, model: "Subscription" }),
    ]);

    expect(responses.map((response) => response.status)).toStrictEqual([200, 200, 200, 200]);
    const bodies: unknown[] = await Promise.all(responses.map((response) => response.json()));
    const text = JSON.stringify(bodies);

    for (const secret of [...secrets, user.password, session.token, accessToken]) {
      expect(text).not.toContain(secret);
    }

    expect(bodies[0]).toMatchObject({ record: { accountId: user.id, userId: user.id } });
    expect(bodies[0]).not.toHaveProperty("record.password");
    expect(bodies[2]).not.toHaveProperty("record.token");
    expect(bodies[3]).not.toHaveProperty("record.providerSubscriptionId");
  });

  it("rejects credential fields in filters and sort keys", async () => {
    await signInStaff();

    const credentials = [
      { fields: ["accessToken", "refreshToken", "idToken", "password"], model: "Account" },
      { fields: ["token"], model: "Session" },
      { fields: ["mockKey", "learnerKey"], model: "AnonymousMockAnswer" },
      { fields: ["providerSubscriptionId"], model: "Subscription" },
    ];

    await Promise.all(
      credentials.flatMap(({ fields, model }) =>
        fields.map(async (field) => {
          const filter = { model, where: [{ field, op: "eq", value: "private-filter-value" }] };

          const responses = await Promise.all([
            list(filter),
            count(filter),
            list({ model, orderBy: { direction: "asc", field } }),
          ]);

          expect(responses.map((response) => response.status)).toStrictEqual([400, 400, 400]);
          const bodies: unknown[] = await Promise.all(responses.map((response) => response.json()));
          expect(JSON.stringify(bodies)).toContain("Field is not readable. Valid fields:");
          expect(JSON.stringify(bodies)).not.toContain("private-filter-value");
        }),
      ),
    );
  });

  it("caps pages at 100 and preserves hasMore and ordering across offsets", async () => {
    await signInStaff();
    const name = `staff-page-${randomUUID()}`;

    await prisma.user.createMany({
      data: Array.from({ length: 101 }, () => ({ email: `${randomUUID()}@example.test`, name })),
    });

    const where = [{ field: "name", op: "eq", value: name }];

    const body = {
      limit: 100,
      model: "User",
      orderBy: { direction: "desc", field: "email" },
      where,
    };

    const [first, last, defaultPage, total, tooMany] = await Promise.all([
      list(body),
      list({ ...body, offset: 100 }),
      list({ model: "User", where }),
      count({ model: "User", where }),
      list({ ...body, limit: 101 }),
    ]);

    expect([
      first.status,
      last.status,
      defaultPage.status,
      total.status,
      tooMany.status,
    ]).toStrictEqual([200, 200, 200, 200, 400]);

    const firstPage = listResponse.parse(await first.json());
    const lastPage = listResponse.parse(await last.json());
    expect(firstPage.records).toHaveLength(100);
    expect(firstPage.hasMore).toBe(true);
    expect(lastPage.records).toHaveLength(1);
    expect(lastPage.hasMore).toBe(false);
    const records = [...firstPage.records, ...lastPage.records];
    expect(new Set(records.map((record) => record.id)).size).toBe(101);
    const emails = records.map((record) => z.string().parse(record.email));
    expect(emails).toStrictEqual(emails.toSorted().toReversed());
    expect(listResponse.parse(await defaultPage.json()).records).toHaveLength(20);
    await expect(total.json()).resolves.toStrictEqual({ count: 101 });
  });

  it("distinguishes missing rows and models requiring compound-key filters", async () => {
    await signInStaff();
    const missing = await get({ id: randomUUID(), model: "User" });
    expect(missing.status).toBe(404);
    const compound = await get({ id: "not-a-primary-key", model: "CourseChapter" });
    expect(compound.status).toBe(400);

    await expect(compound.json()).resolves.toMatchObject({
      error: { message: expect.stringContaining("Use list with filters") },
    });
  });

  it("replays concurrent reads without writes and refuses forged Prisma and actor fields", async () => {
    const { user } = await signInStaff();
    const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const input = { model: "User", where: [{ field: "id", op: "eq", value: user.id }] };
    const repeated = await Promise.all(Array.from({ length: 3 }, () => list(input)));
    const bodies = await Promise.all(repeated.map((response) => response.json()));
    expect(repeated.map((response) => response.status)).toStrictEqual([200, 200, 200]);
    expect(bodies).toStrictEqual([bodies[0], bodies[0], bodies[0]]);

    await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toStrictEqual(
      before,
    );

    const forged = await Promise.all([
      list({ ...input, include: { accounts: true } }),
      list({ ...input, userId: randomUUID() }),
      count({ model: "User", where: { OR: [{ role: "admin" }] } }),
      get({ id: { not: null }, model: "User" }),
    ]);

    expect(forged.map((response) => response.status)).toStrictEqual([400, 400, 400, 400]);
    const retry = await list(input);
    expect(retry.status).toBe(200);
  });
});
