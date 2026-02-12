import { describe, expect, it } from "vitest";
import {
  buildActivityCompletionKey,
  buildChapterCompletionKey,
  buildCourseCompletionKey,
  buildNextActivityKey,
} from "./progress-fetchers";

describe(buildNextActivityKey, () => {
  it("builds key with courseId", () => {
    expect(buildNextActivityKey({ courseId: 1 })).toMatch(
      /\/v1\/progress\/next-activity\?courseId=1$/,
    );
  });

  it("builds key with chapterId", () => {
    expect(buildNextActivityKey({ chapterId: 2 })).toMatch(
      /\/v1\/progress\/next-activity\?chapterId=2$/,
    );
  });

  it("builds key with lessonId", () => {
    expect(buildNextActivityKey({ lessonId: 3 })).toMatch(
      /\/v1\/progress\/next-activity\?lessonId=3$/,
    );
  });

  it("prioritizes courseId over chapterId and lessonId", () => {
    expect(buildNextActivityKey({ chapterId: 2, courseId: 1, lessonId: 3 })).toMatch(
      /\/v1\/progress\/next-activity\?courseId=1$/,
    );
  });

  it("prioritizes chapterId over lessonId", () => {
    expect(buildNextActivityKey({ chapterId: 2, lessonId: 3 })).toMatch(
      /\/v1\/progress\/next-activity\?chapterId=2$/,
    );
  });

  it("builds key with empty query string when no IDs provided", () => {
    expect(buildNextActivityKey({})).toMatch(/\/v1\/progress\/next-activity\?$/);
  });
});

describe(buildCourseCompletionKey, () => {
  it("builds key with courseId", () => {
    expect(buildCourseCompletionKey(42)).toMatch(/\/v1\/progress\/course-completion\?courseId=42$/);
  });
});

describe(buildChapterCompletionKey, () => {
  it("builds key with chapterId", () => {
    expect(buildChapterCompletionKey(7)).toMatch(
      /\/v1\/progress\/chapter-completion\?chapterId=7$/,
    );
  });
});

describe(buildActivityCompletionKey, () => {
  it("builds key with lessonId", () => {
    expect(buildActivityCompletionKey(99)).toMatch(
      /\/v1\/progress\/activity-completion\?lessonId=99$/,
    );
  });
});
