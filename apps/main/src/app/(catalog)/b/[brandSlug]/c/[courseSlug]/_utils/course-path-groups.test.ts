import { type CourseChapter } from "@/data/chapters/list-course-chapters";
import { describe, expect, it } from "vitest";
import { getCoursePathGroups } from "./course-path-groups";

const GROUP_LABELS = ["Introduction", "Basics", "Intermediate", "Advanced"];

/**
 * Builds minimal chapter rows because the grouping helper only needs stable
 * chapter identity and order. Using database fixtures here would make a pure
 * ratio test depend on unrelated publication and Prisma behavior.
 */
function buildCourseChapters({ count }: { count: number }): CourseChapter[] {
  return Array.from(
    { length: count },
    (_, index) => ({ id: `chapter-${index + 1}`, title: `Chapter ${index + 1}` }) as CourseChapter,
  );
}

describe(getCoursePathGroups, () => {
  it("keeps the four-stage path for shorter generated courses", () => {
    const groups = getCoursePathGroups({
      chapters: buildCourseChapters({ count: 28 }),
      labels: GROUP_LABELS,
    });

    expect(groups.map((group) => group.title)).toStrictEqual(GROUP_LABELS);
    expect(groups.map((group) => group.chapters.length)).toStrictEqual([3, 7, 11, 7]);
    expect(groups.map((group) => group.startNumber)).toStrictEqual([1, 4, 11, 22]);
  });

  it("keeps every four-stage group populated at the minimum chapter count", () => {
    const groups = getCoursePathGroups({
      chapters: buildCourseChapters({ count: 4 }),
      labels: GROUP_LABELS,
    });

    expect(groups.map((group) => group.title)).toStrictEqual(GROUP_LABELS);
    expect(groups.map((group) => group.chapters.length)).toStrictEqual([1, 1, 1, 1]);
    expect(groups.map((group) => group.startNumber)).toStrictEqual([1, 2, 3, 4]);
  });

  it("uses a shorter intro and deeper intermediate section for four-part paths", () => {
    const groups = getCoursePathGroups({
      chapters: buildCourseChapters({ count: 70 }),
      labels: GROUP_LABELS,
    });

    expect(groups.map((group) => group.title)).toStrictEqual(GROUP_LABELS);
    expect(groups.map((group) => group.chapters.length)).toStrictEqual([7, 18, 28, 17]);
    expect(groups.map((group) => group.startNumber)).toStrictEqual([1, 8, 26, 54]);
  });

  it("preserves chapter order across weighted groups", () => {
    const chapters = buildCourseChapters({ count: 37 });
    const groups = getCoursePathGroups({ chapters, labels: GROUP_LABELS });

    const groupedChapterIds = groups.flatMap((group) =>
      group.chapters.map((chapter) => chapter.id),
    );

    expect(groups.map((group) => group.chapters.length)).toStrictEqual([4, 9, 15, 9]);
    expect(groupedChapterIds).toStrictEqual(chapters.map((chapter) => chapter.id));
  });
});
