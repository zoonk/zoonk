import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { describe, expect, it } from "vitest";
import { placeContinuations } from "./place-continuations";

describe(placeContinuations, () => {
  it("moves a continuation right after the chapter it continues, before what builds on it", async () => {
    const [course, ...chapters] = await Promise.all([
      courseFixture({ title: "Mathematics" }),
      ...["Linear equations", "Functions", "Quadratics", "Linear equations in context"].map(
        (title) => libraryChapterFixture({ title }),
      ),
    ]);

    await Promise.all(
      chapters.map((chapter, position) =>
        courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position }),
      ),
    );

    const [equations, functions, quadratics, continuation] = chapters;

    await placeContinuations({
      courseId: course.id,
      level: "beginner",
      moves: [{ afterChapterId: equations?.id ?? "", chapterId: continuation?.id ?? "" }],
    });

    const placements = await prisma.courseChapter.findMany({
      orderBy: { position: "asc" },
      select: { chapterId: true, position: true },
      where: { courseId: course.id },
    });

    expect(placements).toStrictEqual(
      [equations, continuation, functions, quadratics].map((chapter, position) => ({
        chapterId: chapter?.id,
        position,
      })),
    );
  });
});
