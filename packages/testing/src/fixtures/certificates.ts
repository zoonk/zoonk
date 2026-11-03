import { type Certificate, prisma } from "@zoonk/db";
import { type FixtureAttrs } from "./_utils/fixture-attrs";

const CODE_LENGTH = 12;

/** Hex digits are all in the codes' Crockford alphabet. */
function testCertificateCode(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, CODE_LENGTH).toUpperCase();
}

export async function certificateFixture(
  attrs: FixtureAttrs<Certificate, "details"> & Pick<Certificate, "userId">,
) {
  return prisma.certificate.create({
    data: {
      code: testCertificateCode(),
      completedOn: new Date("2026-11-03T00:00:00Z"),
      details: {
        category: "science",
        courseLevels: [{ chapters: 3, level: "beginner" }],
        lessonsStudied: 12,
        lessonsTestedOut: 0,
        minutes: 90,
        topics: ["Light and matter"],
      },
      key: crypto.randomUUID(),
      kind: "course",
      language: "en",
      title: "Quantum physics from scratch",
      ...attrs,
    },
  });
}
