import sharp from "sharp";

const SIZE = 128;
const SIDES = ["top", "bottom", "left", "right"] as const;

type Pixel = [number, number, number];

function closeTo(first: Pixel, second: Pixel, tolerance: number) {
  return first.every((channel, index) => Math.abs(channel - (second[index] ?? 0)) <= tolerance);
}

function mostly(pixels: Pixel[], predicate: (pixel: Pixel) => boolean) {
  return pixels.filter((pixel) => predicate(pixel)).length >= 0.9 * pixels.length;
}

function edge(data: Buffer, side: (typeof SIDES)[number], inset: number): Pixel[] {
  const fixed = side === "bottom" || side === "right" ? SIZE - 1 - inset : inset;
  const horizontal = side === "top" || side === "bottom";

  return Array.from({ length: SIZE }, (_, offset) => {
    const index = 3 * (horizontal ? fixed * SIZE + offset : offset * SIZE + fixed);
    return [data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0];
  });
}

function hasBorder(data: Buffer, side: (typeof SIDES)[number]) {
  const outer = edge(data, side, 0);
  const color = outer[Math.floor(SIZE / 2)];

  if (!color || !mostly(outer, (pixel) => closeTo(pixel, color, 10))) {
    return false;
  }

  return Array.from({ length: Math.floor(SIZE / 8) }, (_, index) => index + 1).some((inset) =>
    mostly(
      edge(data, side, inset).slice(inset, SIZE - inset),
      (pixel) => !closeTo(pixel, color, 22),
    ),
  );
}

export async function checkImageEdges(image: Uint8Array) {
  const data = await sharp(image)
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb")
    .resize(SIZE, SIZE, { fit: "fill" })
    .raw()
    .toBuffer();

  const pixels = SIDES.flatMap((side) => edge(data, side, 0));
  const framed = SIDES.every((side) => hasBorder(data, side));

  const white = mostly(
    pixels,
    (pixel) => Math.min(...pixel) >= 248 && Math.max(...pixel) - Math.min(...pixel) <= 6,
  );

  const dark = mostly(pixels, (pixel) => Math.max(...pixel) <= 128);

  const problems = [
    !white &&
      (dark && !framed ? "Dark background at the edges." : "The edges are not plain white."),
    framed && "Solid frame around the image.",
  ].filter((problem) => typeof problem === "string");

  return { passed: 2 - problems.length, problems, total: 2 };
}

export async function scoreImageEdges(image: Uint8Array) {
  const check = await checkImageEdges(image);

  return {
    categoryId: "imageEdges",
    label: "Background and frame",
    reasoning: check.problems.join(" ") || "Plain white at the edges with no solid frame.",
    score: 1 + (9 * check.passed) / check.total,
    weight: 30,
  };
}
