import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { blankIcon, drawnIcon } from "../_test-utils/icon-images";
import { toIconFiles } from "./icon-files";

async function readCorner(file: Buffer) {
  const { data } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return data[3];
}

describe(toIconFiles, () => {
  it("makes square 256 and 96 px WebP files with a transparent outside and a white border", async () => {
    const { large, small } = await toIconFiles(await drawnIcon());

    await expect(sharp(large).metadata()).resolves.toMatchObject({
      format: "webp",
      hasAlpha: true,
      height: 256,
      width: 256,
    });

    await expect(sharp(small).metadata()).resolves.toMatchObject({ height: 96, width: 96 });
    await expect(readCorner(large)).resolves.toBe(0);

    const { data } = await sharp(large).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const edgeOfBorder = (128 * 256 + 11) * 4;

    expect([...data.subarray(edgeOfBorder, edgeOfBorder + 4)]).toStrictEqual([255, 255, 255, 255]);
  });

  it("clears a white background a model drew instead of leaving it transparent", async () => {
    const { large } = await toIconFiles(await drawnIcon({ background: "#FFFFFF" }));
    await expect(readCorner(large)).resolves.toBe(0);
  });

  it("refuses a file with no drawing, a drawing on a dark background, and bytes that aren't an image", async () => {
    await expect(toIconFiles(await blankIcon())).rejects.toThrow("no drawing");

    await expect(toIconFiles(await drawnIcon({ background: "#1E293B" }))).rejects.toThrow(
      "no drawing",
    );

    await expect(toIconFiles(new Uint8Array([1, 2, 3]))).rejects.toThrow("isn't an image");
  });
});
