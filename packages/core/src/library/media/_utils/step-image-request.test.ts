import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import {
  numberedCheckContent,
  pictureCheckContent,
} from "@zoonk/testing/fixtures/playable-step-contents";
import { describe, expect, it } from "vitest";
import { getOptionPictureRequests, getStepImageRequest } from "./step-image-request";

const heart = activityContentFixtures.labeledDiagram;

describe(getStepImageRequest, () => {
  it("asks a labeled diagram for one picture numbered from its parts, in order", () => {
    expect(getStepImageRequest({ content: heart, kind: "activity" })).toMatchObject({
      alt: heart.fields.picture.alt,
      parts: ["right atrium", "left atrium", "right ventricle", "left ventricle", "aorta"],
      prompt: heart.fields.picture.prompt,
    });
  });

  it("asks an explanation for the numbered picture of the diagram it shows to explore", () => {
    const explanation = {
      explore: { fields: heart.fields, template: "labeledDiagram" },
      text: "The heart has four chambers.",
    };

    expect(getStepImageRequest({ content: explanation, kind: "explanation" })?.parts).toHaveLength(
      5,
    );
  });

  it("keeps a question's numbered parts, and no numbers on a picture that has none", () => {
    const plain = { ...numberedCheckContent, image: { alt: "A flower", prompt: "A flower" } };

    expect(
      getStepImageRequest({ content: numberedCheckContent, kind: "check" })?.parts,
    ).toStrictEqual(["petal", "stigma", "ovary"]);

    expect(getStepImageRequest({ content: plain, kind: "check" })?.parts).toBeNull();
  });
});

describe(getOptionPictureRequests, () => {
  it("asks for one picture per option, each with the question as its screen text", () => {
    const requests = getOptionPictureRequests({ content: pictureCheckContent, kind: "check" });

    expect(requests.map((request) => request.optionId)).toStrictEqual([
      "gothic",
      "romanesque",
      "baroque",
    ]);

    // An option's name never reaches the picture: it would give the answer away.
    expect(requests.every((request) => request.screenText === "Which doorway is Gothic?")).toBe(
      true,
    );
  });

  it("asks for none on a question whose options are words", () => {
    const words = {
      ...pictureCheckContent,
      options: pictureCheckContent.options.map(({ picture: _picture, ...option }) => option),
    };

    expect(getOptionPictureRequests({ content: words, kind: "check" })).toStrictEqual([]);
  });
});
