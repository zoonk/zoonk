import { describe, expect, it, vi } from "vitest";
import { getLibraryIdentityQuestion } from "./library-identity-decision";

vi.mock("server-only", () => ({}));
vi.mock("./library-identity-decision.prompt.md", () => ({ default: "Shared rules." }));
vi.mock("./library-identity-course-items.prompt.md", () => ({ default: "Course rules." }));
vi.mock("./library-identity-chapter-lesson.prompt.md", () => ({ default: "Audience rule." }));
vi.mock("./library-identity-skill.prompt.md", () => ({ default: "Action rule." }));
vi.mock("./library-identity-course.prompt.md", () => ({ default: "Field rule." }));
vi.mock("./library-identity-source.prompt.md", () => ({ default: "Edition rule." }));
vi.mock("./library-identity-research-source.prompt.md", () => ({ default: "Topic rule." }));
vi.mock("./library-identity-image.prompt.md", () => ({ default: "Picture rule." }));

describe(getLibraryIdentityQuestion, () => {
  it("gives each kind of item the shared rules and its own, about one candidate", () => {
    expect(getLibraryIdentityQuestion({ kind: "lesson", position: 1 }).instructions).toBe(
      "Shared rules.\nCourse rules.\nAudience rule.\nThis question is about CANDIDATE_2 only.",
    );

    expect(getLibraryIdentityQuestion({ kind: "skill", position: 0 }).instructions).toBe(
      "Shared rules.\nCourse rules.\nAction rule.\nThis question is about CANDIDATE_1 only.",
    );

    expect(getLibraryIdentityQuestion({ kind: "researchSource", position: 0 }).instructions).toBe(
      "Shared rules.\nTopic rule.\nThis question is about CANDIDATE_1 only.",
    );

    expect(getLibraryIdentityQuestion({ kind: "image", position: 0 }).instructions).toBe(
      "Shared rules.\nPicture rule.\nThis question is about CANDIDATE_1 only.",
    );
  });
});
