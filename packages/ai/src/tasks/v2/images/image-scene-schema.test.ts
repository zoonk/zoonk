import { describe, expect, it } from "vitest";
import { type ImageScene, describeImageScene, normalizeImageScene } from "./image-scene-schema";

const discountScene: ImageScene = {
  focalObject: " Two price tags. ",
  labels: [
    { target: "on the old tag", text: "antes R$ 80" },
    { target: "on the new tag", text: "você paga R$ 60" },
  ],
  layout: "sequence",
  motion: "  ",
  relation: "the old tag turns into the new tag.",
  supportingObjects: ["a -25% badge", "", "a receipt", "a wallet"],
};

describe(normalizeImageScene, () => {
  it("keeps at most two supporting objects and three labels of up to four words", () => {
    const scene = normalizeImageScene({
      scene: {
        ...discountScene,
        labels: [
          ...discountScene.labels,
          { target: "on the badge", text: "-25%" },
          { target: "next to the receipt", text: "total" },
          { target: "next to the shelf", text: "this label is too long" },
        ],
      },
      textAllowed: true,
    });

    expect(scene.supportingObjects).toStrictEqual(["a -25% badge", "a receipt"]);

    expect(scene.labels.map((label) => label.text)).toStrictEqual([
      "antes R$ 80",
      "você paga R$ 60",
      "-25%",
    ]);
  });

  it("removes every label where text isn't allowed", () => {
    expect(normalizeImageScene({ scene: discountScene, textAllowed: false }).labels).toStrictEqual(
      [],
    );
  });

  it("treats blank fields as missing and drops trailing periods", () => {
    const scene = normalizeImageScene({ scene: discountScene, textAllowed: true });

    expect(scene).toMatchObject({
      focalObject: "Two price tags",
      motion: null,
      relation: "the old tag turns into the new tag",
    });
  });
});

describe(describeImageScene, () => {
  it("describes the same scene with the same words", () => {
    const scene = normalizeImageScene({ scene: discountScene, textAllowed: true });

    expect(describeImageScene(scene)).toBe(
      'Layout: sequence. Focal object: Two price tags. Supporting objects: a -25% badge; a receipt. Relation: the old tag turns into the new tag. Labels: "antes R$ 80" on the old tag; "você paga R$ 60" on the new tag.',
    );
  });

  it("says when an image has no text", () => {
    const scene = normalizeImageScene({ scene: discountScene, textAllowed: false });
    expect(describeImageScene(scene)).toMatch(/No text\.$/u);
  });
});
