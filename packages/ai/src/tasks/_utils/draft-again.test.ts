import { describe, expect, it, vi } from "vitest";
import { type TaskProvenance } from "../../provenance/task-provenance";
import { draftAgainWhenFlawed } from "./draft-again";

type Draft = { problems: number; provenance: TaskProvenance; setAside?: TaskProvenance[] };

function call(runId: string): TaskProvenance {
  return {
    generatedAt: "2026-11-06T00:00:00.000Z",
    latencyMs: 1000,
    model: "openai/gpt-6.1-terra",
    promptVersion: "v1",
    provider: "openai",
    requestedModel: "openai/gpt-6.1-terra",
    runId,
    usage: { inputTokens: 1000, outputTokens: 100 },
  };
}

function draftWith(runId: string, problems: number, setAside?: TaskProvenance[]): Draft {
  return { problems, provenance: call(runId), setAside };
}

const countProblems = (draft: Draft) => draft.problems;

describe(draftAgainWhenFlawed, () => {
  it("drafts once when code finds nothing wrong", async () => {
    const clean = draftWith("clean", 0);
    const draft = vi.fn().mockResolvedValue(clean);

    await expect(draftAgainWhenFlawed({ countProblems, draft })).resolves.toStrictEqual({
      ...clean,
      setAside: [],
    });

    expect(draft).toHaveBeenCalledOnce();
  });

  it("drafts once more when code finds problems, keeps the draft with fewer and sets the other aside", async () => {
    const first = draftWith("first", 2);
    const second = draftWith("second", 1);
    const draft = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);

    await expect(draftAgainWhenFlawed({ countProblems, draft })).resolves.toStrictEqual({
      ...second,
      setAside: [first.provenance],
    });

    expect(draft.mock.calls).toStrictEqual([[null], [first]]);
  });

  it("keeps the first draft on a tie and sets the second aside", async () => {
    const first = draftWith("first", 1);
    const second = draftWith("second", 1);
    const draft = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);

    await expect(draftAgainWhenFlawed({ countProblems, draft })).resolves.toStrictEqual({
      ...first,
      setAside: [second.provenance],
    });
  });

  it("keeps the first draft when the second call fails", async () => {
    const first = draftWith("first", 1);
    const draft = vi.fn().mockResolvedValueOnce(first).mockRejectedValueOnce(new Error("down"));

    await expect(draftAgainWhenFlawed({ countProblems, draft })).resolves.toStrictEqual({
      ...first,
      setAside: [],
    });
  });

  it("carries the calls a draft already set aside, whether it's kept or set aside", async () => {
    const first = draftWith("first", 2, [call("first-inner")]);
    const second = draftWith("second", 1, [call("second-inner")]);
    const draft = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);

    const kept = await draftAgainWhenFlawed({ countProblems, draft });

    expect(kept.provenance.runId).toBe("second");

    expect(kept.setAside.map((provenance) => provenance.runId)).toStrictEqual([
      "second-inner",
      "first-inner",
      "first",
    ]);
  });
});
