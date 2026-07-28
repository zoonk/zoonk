import { describe, expect, it } from "vitest";
import { getGenerationEventsUrl } from "./generation-events-url";

describe(getGenerationEventsUrl, () => {
  it("builds a resumable resource URL with an encoded generation id", () => {
    expect(
      getGenerationEventsUrl({
        baseUrl: "https://api.example.com/v1/generations",
        generationId: "run/with spaces",
        reconnectCount: 2,
      }),
    ).toBe("https://api.example.com/v1/generations/run%2Fwith%20spaces/events?_rc=2");
  });
});
