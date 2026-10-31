import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

function readRecorded(name: string): unknown {
  return JSON.parse(
    readFileSync(new URL(`../goals/_test-fixtures/${name}.json`, import.meta.url), "utf8"),
  );
}

export function recordedOutput<T>(
  name: "course-outline" | "goal-specificity" | "lesson-draft" | "lesson-spec" | "skill-graph",
): T {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Recorded from the task that returns T.
  return readRecorded(`vaccines-${name}`) as T;
}

export function taskResult<T>(data: T, model = "openai/gpt-6-sol") {
  return {
    data,
    provenance: {
      costUsd: 0,
      generatedAt: new Date().toISOString(),
      latencyMs: 1,
      model,
      promptVersion: "recorded",
      provider: model.split("/")[0] ?? "test",
      requestedModel: model,
      runId: randomUUID(),
      usage: {},
    },
    systemPrompt: "",
    usage: {
      inputTokenDetails: {
        cacheReadTokens: undefined,
        cacheWriteTokens: undefined,
        noCacheTokens: 0,
      },
      inputTokens: 0,
      outputTokenDetails: { reasoningTokens: undefined, textTokens: 0 },
      outputTokens: 0,
      totalTokens: 0,
    },
    userPrompt: "",
  };
}

export function outlineResult<T>(data: T) {
  return { ...taskResult(data), setAside: [] };
}

type StreamedOutline<Chapter> = { chapters: readonly Chapter[] };

export function replayStreamedOutline<Chapter>(outline: StreamedOutline<Chapter>) {
  return async ({
    isEarlyChapter,
    saveEarlyChapter,
  }: {
    isEarlyChapter: (chapter: Chapter) => boolean;
    saveEarlyChapter: (found: {
      before: Chapter[];
      chapter: Chapter;
      provenance: ReturnType<typeof taskResult>["provenance"];
    }) => Promise<unknown>;
  }) => {
    const result = taskResult(outline);
    const index = outline.chapters.findIndex((chapter) => isEarlyChapter(chapter));
    const chapter = outline.chapters[index];

    const early = chapter
      ? await saveEarlyChapter({
          before: outline.chapters.slice(0, index),
          chapter,
          provenance: result.provenance,
        })
      : null;

    return { ...result, early };
  };
}
