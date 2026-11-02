import { describe, expect, it } from "vitest";
import { routeNextModule } from "./adaptive-routing";

const ROUTING = { easier: ["e1", "e2", "e3"], harder: ["h1", "h2", "h3"] };

describe(routeNextModule, () => {
  it("sends a strong first module to the harder set", () => {
    expect(
      routeNextModule({ correct: 7, questions: 2, routing: ROUTING, total: 10 }),
    ).toStrictEqual(["h1", "h2"]);
  });

  it("sends a weaker first module, or an empty one, to the easier set", () => {
    expect(
      routeNextModule({ correct: 5, questions: 3, routing: ROUTING, total: 10 }),
    ).toStrictEqual(ROUTING.easier);

    expect(routeNextModule({ correct: 0, questions: 3, routing: ROUTING, total: 0 })).toStrictEqual(
      ROUTING.easier,
    );
  });
});
