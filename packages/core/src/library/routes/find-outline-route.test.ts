import { describe, expect, it } from "vitest";
import { findOutlineChapter, findOutlineLesson } from "./find-outline-route";

const COURSE_ID = "course-a";

function chapter(id: string, slug: string, homeCourseId: string | null = COURSE_ID) {
  return { homeCourseId, id, slug };
}

describe(findOutlineChapter, () => {
  const levels = [
    { chapters: [chapter("overview", "overview")] },
    { chapters: [chapter("atoms", "atoms"), chapter("waves", "waves")] },
    { chapters: [chapter("fields", "fields")] },
  ];

  it("numbers the chapter across every level band", () => {
    expect(findOutlineChapter({ chapterSlug: "waves", courseId: COURSE_ID, levels })).toStrictEqual(
      { chapter: chapter("waves", "waves"), number: 3, total: 4 },
    );
  });

  it("returns null when no chapter has the slug", () => {
    expect(findOutlineChapter({ chapterSlug: "missing", courseId: COURSE_ID, levels })).toBeNull();
  });

  it("prefers the chapter made for this course when a reused chapter shares its slug", () => {
    const reused = chapter("reused", "atoms", "course-b");
    const own = chapter("own", "atoms");

    const result = findOutlineChapter({
      chapterSlug: "atoms",
      courseId: COURSE_ID,
      levels: [{ chapters: [reused, own] }],
    });

    expect(result?.chapter).toBe(own);
    expect(result?.number).toBe(2);
  });

  it("falls back to the first reused chapter in outline order", () => {
    const first = chapter("first", "atoms", "course-b");
    const second = chapter("second", "atoms", "course-c");

    const result = findOutlineChapter({
      chapterSlug: "atoms",
      courseId: COURSE_ID,
      levels: [{ chapters: [first, second] }],
    });

    expect(result?.chapter).toBe(first);
  });
});

describe(findOutlineLesson, () => {
  it("prefers the lesson made for this chapter", () => {
    const reused = { homeChapterId: "other", id: "reused", slug: "electrons" };
    const own = { homeChapterId: "chapter", id: "own", slug: "electrons" };

    expect(
      findOutlineLesson({ chapterId: "chapter", lessonSlug: "electrons", lessons: [reused, own] }),
    ).toBe(own);
  });

  it("returns a reused lesson when it's the only match", () => {
    const reused = { homeChapterId: "other", id: "reused", slug: "electrons" };

    expect(
      findOutlineLesson({ chapterId: "chapter", lessonSlug: "electrons", lessons: [reused] }),
    ).toBe(reused);
  });

  it("returns null when no lesson has the slug", () => {
    expect(findOutlineLesson({ chapterId: "chapter", lessonSlug: "x", lessons: [] })).toBeNull();
  });
});
