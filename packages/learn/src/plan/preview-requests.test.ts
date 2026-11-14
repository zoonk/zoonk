import { describe, expect, it } from "vitest";
import { createPreviewRequests } from "./preview-requests";

const answer = { effect: "the card's numbers" };

describe(createPreviewRequests, () => {
  it("gives a wanted request its answer", async () => {
    const requests = createPreviewRequests();
    await expect(requests.run({}, async () => answer)).resolves.toBe(answer);
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
