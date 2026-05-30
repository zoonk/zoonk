import { describe, expect, it } from "vitest";
import { getLessonAccessRequirement } from "./access";

describe(getLessonAccessRequirement, () => {
  it("allows unauthenticated learners through the first five lessons of the first chapter", () => {
    const requirement = getLessonAccessRequirement({
      isAuthenticated: false,
      lesson: { chapter: { position: 0 }, position: 4 },
    });

    expect(requirement).toBe("free");
  });

  it("asks unauthenticated learners to log in for lessons six through ten", () => {
    const requirement = getLessonAccessRequirement({
      isAuthenticated: false,
      lesson: { chapter: { position: 0 }, position: 5 },
    });

    expect(requirement).toBe("authentication");
  });

  it("allows authenticated learners through the first ten lessons of the first chapter", () => {
    const requirement = getLessonAccessRequirement({
      isAuthenticated: true,
      lesson: { chapter: { position: 0 }, position: 9 },
    });

    expect(requirement).toBe("free");
  });

  it("requires a subscription starting at lesson eleven in the first chapter", () => {
    const requirement = getLessonAccessRequirement({
      isAuthenticated: true,
      lesson: { chapter: { position: 0 }, position: 10 },
    });

    expect(requirement).toBe("subscription");
  });

  it("requires a subscription for every lesson outside the first chapter", () => {
    const requirement = getLessonAccessRequirement({
      isAuthenticated: true,
      lesson: { chapter: { position: 1 }, position: 0 },
    });

    expect(requirement).toBe("subscription");
  });
});
