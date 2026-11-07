import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
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

async function writeSeedCourse() {
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
  const reseed = () => writeLibraryCourse({ course, organizationId: organization.id, prisma });
  await reseed();

  return { lessonId: libraryIds.lesson(key, "colors", "en"), reseed };
}

function resetLesson(lessonId: string) {
  return prisma.$transaction([
    prisma.step.updateMany({ data: { retiredAt: new Date() }, where: { lessonId } }),
    prisma.lesson.update({
      data: { contentStatus: "pending", specStatus: "pending" },
      where: { id: lessonId },
    }),
  ]);
}

function readLesson(lessonId: string) {
  return prisma.lesson.findUniqueOrThrow({
    select: { _count: { select: { steps: { where: CURRENT_STEPS } } }, contentStatus: true },
    where: { id: lessonId },
  });
}

describe("seeded lessons", () => {
  it("are written again by a reseed after a migration retires their screens", async () => {
    const { lessonId, reseed } = await writeSeedCourse();

    await resetLesson(lessonId);
    await reseed();

    await expect(readLesson(lessonId)).resolves.toStrictEqual({
      _count: { steps: 2 },
      contentStatus: "completed",
    });
  });

  it("are written again when the app's own version was retired with them, which stays", async () => {
    const { lessonId, reseed } = await writeSeedCourse();

    await prisma.step.updateMany({ data: { retiredAt: new Date() }, where: { lessonId } });
    const appStep = await libraryStepFixture({ lessonId, position: 0, version: 2 });

    await resetLesson(lessonId);
    await reseed();

    const [lesson, kept] = await Promise.all([
      readLesson(lessonId),
      prisma.step.findUnique({ select: { retiredAt: true }, where: { id: appStep.id } }),
    ]);

    expect(lesson).toStrictEqual({ _count: { steps: 2 }, contentStatus: "completed" });
    expect(kept?.retiredAt).toBeInstanceOf(Date);
  });
});
