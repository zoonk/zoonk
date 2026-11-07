import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, it } from "vitest";
import { t } from "../../../db/src/prisma/seed/_utils/localize";
import { libraryIds } from "../../../db/src/prisma/seed/library/library-ids";
import { type SeedCourse } from "../../../db/src/prisma/seed/library/types";
import { writeLibraryCourse } from "../../../db/src/prisma/seed/library/write-course";
import { CURRENT_STEPS } from "../library/lessons/lesson-versions";

function explanation(title: string) {
  return {
    content: { text: t(title, title), title: t(title, title) },
    kind: "explanation" as const,
  };
}

describe("seeded lessons", () => {
  it("are written again by a reseed after a migration retires their screens", async () => {
    const key = `seeded-lessons-${randomUUID()}`;

    const course: SeedCourse = {
      category: "science",
      chapters: [
        {
          description: t("Light", "Luz"),
          key: "light",
          lessons: [
            {
              description: t("Why colors exist", "Por que as cores existem"),
              key: "colors",
              minutes: 5,
              skills: ["emission"],
              steps: [explanation("Energy comes in steps"), explanation("The drop is the color")],
              title: t("Why colors exist", "Por que as cores existem"),
            },
          ],
          level: "beginner",
          objectives: [],
          title: t("Light", "Luz"),
        },
      ],
      description: t("Physics", "Física"),
      format: "core",
      items: [],
      key,
      languages: ["en"],
      skills: [
        {
          description: t("Emission lines", "Linhas de emissão"),
          key: "emission",
          level: "beginner",
          name: t(`Emission lines ${key}`, `Linhas de emissão ${key}`),
        },
      ],
      slug: t(`${key}-en`, `${key}-pt`),
      title: t("Physics", "Física"),
    };

    const organization = await organizationFixture();
    const lessonId = libraryIds.lesson(key, "colors", "en");

    await writeLibraryCourse({ course, organizationId: organization.id, prisma });

    await prisma.$transaction([
      prisma.step.updateMany({ data: { retiredAt: new Date() }, where: { lessonId } }),
      prisma.lesson.update({
        data: { contentStatus: "pending", specStatus: "pending" },
        where: { id: lessonId },
      }),
    ]);

    await writeLibraryCourse({ course, organizationId: organization.id, prisma });

    await expect(
      prisma.lesson.findUniqueOrThrow({
        select: { _count: { select: { steps: { where: CURRENT_STEPS } } }, contentStatus: true },
        where: { id: lessonId },
      }),
    ).resolves.toStrictEqual({ _count: { steps: 2 }, contentStatus: "completed" });
  });
});
