import { writtenChallengeCaseFixture } from "@zoonk/testing/fixtures/challenge-written-case";
import { describe, expect, it } from "vitest";
import { checkWrittenChallenge } from "./challenge-case-content";

type WrittenCase = ReturnType<typeof writtenChallengeCaseFixture>;

/** Every decision with its choices in the order the writer listed them, strongest first. */
function withStrongestFirst(written: WrittenCase): WrittenCase {
  return {
    ...written,
    nodes: written.nodes.map((node) => ({
      ...node,
      choices: node.choices.toSorted((first, second) =>
        first.quality === "strong" ? -1 : Number(second.quality === "strong"),
      ),
    })),
  };
}

function choiceIdsByNode(written: WrittenCase): string[][] {
  const { content } = checkWrittenChallenge({ variant: "work", written });
  return content?.nodes.map((node) => node.choices.map((choice) => choice.id)) ?? [];
}

describe(checkWrittenChallenge, () => {
  it("doesn't keep the strongest choice first in every decision", () => {
    const written = withStrongestFirst(writtenChallengeCaseFixture());
    const { content } = checkWrittenChallenge({ variant: "work", written });

    expect(written.nodes.every((node) => node.choices[0]?.quality === "strong")).toBe(true);

    const firstQualities = content?.nodes.map((node) => node.choices[0]?.quality) ?? [];

    expect(firstQualities.length).toBeGreaterThan(1);
    expect(firstQualities.every((quality) => quality === "strong")).toBe(false);
  });

  it("keeps every choice and the same order on every check", () => {
    const written = writtenChallengeCaseFixture();
    const ids = choiceIdsByNode(written);

    expect(ids).toStrictEqual(choiceIdsByNode(written));

    expect(ids.map((choices) => choices.toSorted())).toStrictEqual(
      written.nodes.map((node) => node.choices.map((choice) => choice.id).toSorted()),
    );
  });
});
