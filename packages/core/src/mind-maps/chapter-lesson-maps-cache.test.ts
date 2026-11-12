import { randomUUID } from "node:crypto";
import * as database from "@zoonk/db";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { cacheTag } from "next/cache";
import { describe, expect, it } from "vitest";
import { type CacheWrapper, compileCachedModule } from "../_test-utils/compiled-cache";
import * as cacheTags from "../cache/tags";
import * as lessonMarks from "../lesson-player/_utils/lesson-marks";
import * as challengeSpec from "../library/challenges/challenge-lesson-spec";
import { completeLessonContent } from "../library/generation/lesson-generation-state";
import * as lessonMap from "../library/lessons/lesson-map";
import { type getChapterLessonMaps } from "./_utils/chapter-lesson-maps";

/** Main's own cache: the API's tag expiries never reach it, so an entry stays until its key changes. */
function mainCache() {
  const entries = new Map<string, Promise<unknown>>();
  const reads = { count: 0 };

  const cache: CacheWrapper = (_kind, id, _boundArgs, read, args) => {
    const key = JSON.stringify([id, args]);

    const entry =
      entries.get(key) ??
      (() => {
        reads.count += 1;
        return read(...args);
      })();

    entries.set(key, entry);
    return entry;
  };

  return { cache, reads };
}

async function compileForMain(cache: CacheWrapper) {
  const compiled = await compileCachedModule({
    cache,
    imports: {
      "../../cache/tags": cacheTags,
      "../../lesson-player/_utils/lesson-marks": lessonMarks,
      "../../library/challenges/challenge-lesson-spec": challengeSpec,
      "../../library/lessons/lesson-map": lessonMap,
      "@zoonk/db": database,
      "next/cache": { cacheTag },
    },
    source: new URL("_utils/chapter-lesson-maps.ts", import.meta.url),
  });

  return compiled as { getChapterLessonMaps: typeof getChapterLessonMaps };
}

describe("the chapter lesson maps Main keeps", () => {
  it("shows a lesson the API finished writing after Main kept the chapter without it", async () => {
    const workflowRunId = `run-${randomUUID()}`;
    const chapter = await libraryChapterFixture();

    const lesson = await libraryLessonFixture({
      contentRunId: workflowRunId,
      contentStatus: "running",
      summary: { ideas: [{ text: "Atoms are tiny." }] },
    });

    await chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 });

    const { cache, reads } = mainCache();
    const main = await compileForMain(cache);

    const read = async () => {
      const maps = await main.getChapterLessonMaps([chapter.id]);
      return maps.get(chapter.id);
    };

    await expect(read()).resolves.toStrictEqual([]);
    await expect(read()).resolves.toStrictEqual([]);
    expect(reads.count).toBe(1);

    await completeLessonContent({ lessonId: lesson.id, workflowRunId });

    await expect(read()).resolves.toMatchObject([
      { lessonId: lesson.id, map: { ideas: [{ text: "Atoms are tiny." }] }, position: 1 },
    ]);
  });
});
