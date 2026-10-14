import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, it } from "vitest";
import { t } from "../../../../db/src/prisma/seed/v2/_utils/localize";
import { libraryIds } from "../../../../db/src/prisma/seed/v2/library/library-ids";
import { type SeedCourse } from "../../../../db/src/prisma/seed/v2/library/types";
import { writeLibraryCourse } from "../../../../db/src/prisma/seed/v2/library/write-course";
import { loadCourseOutline } from "../../goals/_utils/course-outline";

describe("seeded course outline areas", () => {
  it("captures localized areas and repairs seeded placements while keeping generated chapters and positions", async () => {
    const key = `outline-area-${randomUUID()}`;

    const course: SeedCourse = {
      category: "society",
      chapters: [
        {
          area: t("Math", "Matemática"),
          description: t("Fractions", "Frações"),
          key: "fractions",
          lessons: [],
          level: "beginner",
          objectives: [],
          title: t("Fractions", "Frações"),
        },
      ],
      description: t("Exam preparation", "Preparação para a prova"),
      format: "exam",
      items: [],
      key,
      languages: ["en", "pt"],
      skills: [],
      slug: t(`${key}-en`, `${key}-pt`),
      title: t("Exam course", "Curso para a prova"),
    };

    const organization = await organizationFixture();
    await writeLibraryCourse({ course, organizationId: organization.id, prisma });

    await Promise.all([
      expect(
        loadCourseOutline({ courseId: libraryIds.course(key, "en"), userId: null }),
      ).resolves.toMatchObject([{ area: "Math", position: 0 }]),
      expect(
        loadCourseOutline({ courseId: libraryIds.course(key, "pt"), userId: null }),
      ).resolves.toMatchObject([{ area: "Matemática", position: 0 }]),
    ]);

    const courseId = libraryIds.course(key, "pt");
    const chapterId = libraryIds.chapter(key, "fractions", "pt");
    const generated = await libraryChapterFixture({ language: "pt" });

    await prisma.courseChapter.update({
      data: { area: null, position: 3 },
      where: { courseId_chapterId: { chapterId, courseId } },
    });

    await courseChapterFixture({ area: "Redação", chapterId: generated.id, courseId, position: 0 });

    await writeLibraryCourse({ course, organizationId: organization.id, prisma });

    await expect(loadCourseOutline({ courseId, userId: null })).resolves.toMatchObject([
      { area: "Redação", chapterId: generated.id, position: 0 },
      { area: "Matemática", chapterId, position: 3 },
    ]);
  });
});
