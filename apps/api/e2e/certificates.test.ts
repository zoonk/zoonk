import { request } from "@playwright/test";
import { expect, test } from "@zoonk/e2e/fixtures";
import { certificateFixture } from "@zoonk/testing/fixtures/certificates";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { formatCertificateCode } from "@zoonk/utils/certificate-links";
import {
  certificateListResponseSchema,
  certificateSchema,
  goalCertificatesResponseSchema,
} from "../src/lib/openapi/schemas/certificates";
import { createAuthenticatedApiContext } from "./helpers/auth";
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

    expect(new URL(body.url).pathname).toBe(`/c/${formatCertificateCode(certificate.code)}`);

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

  test("keeps a locked certificate its owner's: no public page, no links, views still work", async () => {
    const [{ apiContext, user }, anonymous] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "certificate-locked" }),
      request.newContext({ baseURL }),
    ]);

    const certificate = await certificateFixture({ issuedAt: null, userId: user.id });

    const [publicRead, list, view] = await Promise.all([
      anonymous.get(`/v1/certificates/${certificate.code}`),
      apiContext.get("/v1/me/certificates"),
      apiContext.post(`/v1/me/certificates/${certificate.code}/views`),
    ]);

    expect([publicRead.status(), view.status()]).toStrictEqual([404, 204]);

    await expect(
      readBody({ response: list, schema: certificateListResponseSchema }),
    ).resolves.toMatchObject({
      certificates: [
        { code: certificate.code, imageUrls: null, linkedInUrl: null, locked: true, url: null },
      ],
    });

    await Promise.all([apiContext.dispose(), anonymous.dispose()]);
  });

  test("claims a finished level for the goal and returns the goal's certificates", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "certificate-claim",
    });

    const [course, chapter] = await Promise.all([
      courseFixture({ isPublished: true, title: "Robotics", visibility: "public" }),
      libraryChapterFixture({ title: "Sensors" }),
    ]);

    await courseChapterFixture({ chapterId: chapter.id, courseId: course.id, level: "beginner" });

    const [goal, unfinished] = await Promise.all([
      goalFixture({ primaryCourseId: course.id, userId: user.id }),
      goalFixture({ userId: user.id }),
    ]);

    const finished = { completedAt: new Date("2026-10-20T12:00:00Z"), status: "done" } as const;

    await Promise.all([
      planFixture({
        goalId: goal.id,
        items: [
          { ...finished, chapterId: chapter.id },
          { ...finished, kind: "boss" },
        ],
      }),
      planFixture({ goalId: unfinished.id, items: [{}] }),
    ]);

    const [claimed, notFinished] = await Promise.all([
      apiContext.post(`/v1/goals/${goal.id}/certificates`),
      apiContext.post(`/v1/goals/${unfinished.id}/certificates`),
    ]);

    await expect(
      readBody({ response: claimed, schema: goalCertificatesResponseSchema }),
    ).resolves.toMatchObject({
      certificates: [
        {
          completedOn: "2026-10-20",
          courseLevel: "beginner",
          locked: true,
          title: "Robotics",
          url: null,
        },
      ],
    });

    expect(notFinished.status()).toBe(409);

    await expect(notFinished.json()).resolves.toMatchObject({
      error: { code: "COURSE_NOT_FINISHED" },
    });

    await apiContext.dispose();
  });
});
