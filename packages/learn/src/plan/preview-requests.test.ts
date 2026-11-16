import { type PlanChangePreview } from "@zoonk/core/plans/preview-contract";
import { describe, expect, it } from "vitest";
import { previewPlan } from "../_test-utils/plan-preview";
import { type PlanPreviewState, resolvePlanPreview } from "./plan-preview-state";
import { createPreviewRequests } from "./preview-requests";

const answer = { effect: "the card's numbers" };

describe(createPreviewRequests, () => {
  it("gives a wanted request its answer through refreshes of the same opening", async () => {
    const requests = createPreviewRequests(() => {});
    const late = Promise.withResolvers<typeof answer>();
    requests.showOpening("fitLessons");
    const pending = requests.run({}, () => late.promise);

    requests.showOpening("fitLessons");
    late.resolve(answer);

    await expect(pending).resolves.toBe(answer);
  });

  it("gives nothing to a request cancelled while its answer was on the way", async () => {
    const requests = createPreviewRequests(() => {});
    const late = Promise.withResolvers<typeof answer>();
    const pending = requests.run({}, () => late.promise);

    requests.cancel();
    late.resolve(answer);

    await expect(pending).resolves.toBeNull();
  });

  it("keeps a request across an unchanged base and drops it when the base changes", async () => {
    const requests = createPreviewRequests(() => {});
    const base = {};
    const late = Promise.withResolvers<typeof answer>();
    requests.showBase(base);
    const pending = requests.run({}, () => late.promise);

    requests.showBase(base);
    requests.showBase({});
    late.resolve(answer);

    await expect(pending).resolves.toBeNull();
  });

  it("gives nothing to a request a newer one replaced", async () => {
    const requests = createPreviewRequests(() => {});
    const late = Promise.withResolvers<typeof answer>();
    const earlier = requests.run({}, () => late.promise);
    const later = requests.run({}, async () => answer);

    late.resolve(answer);

    await expect(earlier).resolves.toBeNull();
    await expect(later).resolves.toBe(answer);
  });
});

describe("suggestion opening", () => {
  it("does not add a held fit answer after a refresh replaces the selected suggestion", async () => {
    const requests = createPreviewRequests(() => {});
    const late = Promise.withResolvers<typeof answer>();
    const changes: object[] = [];
    requests.showOpening("fitLessons");

    const pending = requests
      .run({}, () => late.promise)
      .then((result) => {
        if (result) {
          changes.push(result);
        }
      });

    requests.showOpening("doesNotFit");
    late.resolve(answer);
    await pending;

    expect(changes).toStrictEqual([]);
  });

  it.each([
    null,
    { effect: null, feasibility: null, finishDate: null, ready: true, unchanged: true },
  ])(
    "reopens a replaced fit suggestion idle before and after its late answer (%j)",
    async (lateAnswer: PlanChangePreview | null) => {
      const request = { operations: [], plan: previewPlan(), status: "loading" as const };
      const shown: { preview: PlanPreviewState } = { preview: request };

      const requests = createPreviewRequests(() => {
        shown.preview = { status: "idle" };
      });

      const late = Promise.withResolvers<PlanChangePreview | null>();
      requests.showOpening("fitLessons");
      shown.preview = request;

      const pending = requests.run(request, async () => {
        const preview = await late.promise;
        shown.preview = resolvePlanPreview({ current: shown.preview, preview, request });
        return preview;
      });

      requests.showOpening("paused");
      requests.showOpening("fitLessons");
      expect(shown.preview.status).toBe("idle");

      late.resolve(lateAnswer);
      await expect(pending).resolves.toBeNull();
      expect(shown.preview.status).toBe("idle");
    },
  );
});
