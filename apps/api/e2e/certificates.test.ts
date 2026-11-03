import { request } from "@playwright/test";
import { expect, test } from "@zoonk/e2e/fixtures";
import { certificateFixture } from "@zoonk/testing/fixtures/certificates";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { formatCertificateCode } from "@zoonk/utils/certificate-links";
import { certificateSchema } from "../src/lib/openapi/schemas/certificates";
import { readBody } from "./helpers/response";

test.describe("Certificates API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test("shows a certificate to anyone with its code, and nothing else about the learner", async () => {
    const user = await userFixture({ name: "Ana Souza" });
    const goal = await goalFixture({ userId: user.id });
    const certificate = await certificateFixture({ goalId: goal.id, userId: user.id });
    const anonymous = await request.newContext({ baseURL });
    const typed = formatCertificateCode(certificate.code).toLowerCase();

    const response = await anonymous.get(`/v1/certificates/${typed}`);
    const body = await readBody({ response, schema: certificateSchema });

    expect(response.headers()["x-robots-tag"]).toBe("noindex");

    expect(body).toMatchObject({
      code: certificate.code,
      kind: "course",
      recipientName: "Ana Souza",
      title: "Quantum physics from scratch",
    });

    expect(new URL(body.url).pathname).toBe(`/c/${certificate.code}`);

    expect(new URL(body.imageUrls.print).pathname).toBe(
      `/en/c/${certificate.code}/image/print.png`,
    );

    expect(JSON.stringify(body)).not.toContain(user.id);
    expect(JSON.stringify(body)).not.toContain(goal.id);
    expect(JSON.stringify(body)).not.toContain(user.email);

    const missing = await Promise.all(
      ["0000-0000-0000", "not-a-code"].map((code) => anonymous.get(`/v1/certificates/${code}`)),
    );

    expect(missing.map((item) => item.status())).toStrictEqual([404, 404]);
    await anonymous.dispose();
  });
});
