import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { examBlueprintResourceSchema } from "../src/lib/openapi/schemas/research-sources";
import { createBearerLearner } from "./helpers/bearer";
import { EXAM_IN_DAYS, examEdition, isoDayFromToday } from "./helpers/exams";
import { readBody } from "./helpers/response";

const citation = { passage: "A prova terá 12 questões.", sourceId: "notice" };

const STRUCTURE = {
  formats: [{ citation, description: "Certo ou errado", kind: "trueFalse", options: null }],
  mock: null,
  rules: [{ citation, text: "Uma resposta errada anula uma certa." }],
  subjects: [{ citation, name: "Law", questions: 12, topics: ["Statutes"], weight: 1 }],
};

test.describe("Exam blueprints API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("shows a public blueprint to anyone, with the notice it was read from", async () => {
    const anonymous = await request.newContext({ baseURL });
    const notice = await sourceFixture({ publisher: "Cebraspe", title: "Edital nº 1" });
    const edition = examEdition(isoDayFromToday(EXAM_IN_DAYS));

    const blueprint = await examBlueprintFixture({
      board: "Cebraspe",
      edition,
      name: "Concurso TCDF",
      sourceId: notice.id,
      structure: STRUCTURE,
    });

    const response = await anonymous.get(`/v1/exam-blueprints/${blueprint.id}`);
    const body = await readBody({ response, schema: examBlueprintResourceSchema });

    expect(body).toMatchObject({
      board: "Cebraspe",
      country: "BR",
      edition,
      id: blueprint.id,
      name: "Concurso TCDF",
      source: {
        id: notice.id,
        kind: "official",
        publisher: "Cebraspe",
        reusePolicy: null,
        title: "Edital nº 1",
        url: notice.url,
      },
      structure: STRUCTURE,
      topicFrequency: [],
    });

    // The notice's text, hash and storage stay on the server.
    const raw = await response.json();

    expect(Object.keys(raw.source).toSorted()).toStrictEqual(
      Object.keys(examBlueprintResourceSchema.shape.source.unwrap().shape).toSorted(),
    );

    await anonymous.dispose();
  });

  test("shows a blueprint read from a learner's private material to that learner only", async () => {
    const [owner, other, anonymous] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "blueprint-owner" }),
      createBearerLearner({ baseURL, prefix: "blueprint-other" }),
      request.newContext({ baseURL }),
    ]);

    const blueprint = await examBlueprintFixture({
      name: "Prova de História do 9º ano",
      ownerId: owner.userId,
      structure: STRUCTURE,
      visibility: "private",
    });

    const path = `/v1/exam-blueprints/${blueprint.id}`;

    const own = await readBody({
      response: await owner.api.get(path),
      schema: examBlueprintResourceSchema,
    });

    expect(own).toMatchObject({ id: blueprint.id, name: "Prova de História do 9º ano" });

    const [hidden, hiddenFromVisitor, unknown, invalid] = await Promise.all([
      other.api.get(path),
      anonymous.get(path),
      owner.api.get(`/v1/exam-blueprints/${randomUUID()}`),
      owner.api.get("/v1/exam-blueprints/not-a-blueprint"),
    ]);

    expect([hidden, hiddenFromVisitor, unknown, invalid].map((res) => res.status())).toStrictEqual([
      404, 404, 404, 400,
    ]);

    await Promise.all([owner.api.dispose(), other.api.dispose(), anonymous.dispose()]);
  });
});
