import { describe, expect, it } from "vitest";
import { createPreviewRequests } from "./preview-requests";

const answer = { effect: "the card's numbers" };

describe(createPreviewRequests, () => {
  it("gives a wanted request its answer through refreshes of the same opening", async () => {
    const requests = createPreviewRequests();
    const late = Promise.withResolvers<typeof answer>();
    requests.showOpening("fitLessons");
    const pending = requests.run({}, () => late.promise);

    requests.showOpening("fitLessons");
    late.resolve(answer);

    await expect(pending).resolves.toBe(answer);
  });

  it("gives nothing to a request cancelled while its answer was on the way", async () => {
    const requests = createPreviewRequests();
    const late = Promise.withResolvers<typeof answer>();
    const pending = requests.run({}, () => late.promise);

    requests.cancel();
    late.resolve(answer);

    await expect(pending).resolves.toBeNull();
  });

  it("gives nothing to a request a newer one replaced", async () => {
    const requests = createPreviewRequests();
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
    const requests = createPreviewRequests();
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
});
