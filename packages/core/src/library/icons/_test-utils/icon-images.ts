import sharp from "sharp";

const CIRCLE = `<circle cx="256" cy="256" r="160" fill="#F4B740" stroke="#000" stroke-width="16"/>`;

export function drawnIcon({ background }: { background?: string } = {}): Promise<Buffer> {
  const fill = background ? `<rect width="512" height="512" fill="${background}"/>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">${fill}${CIRCLE}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export function blankIcon(): Promise<Buffer> {
  return sharp({ create: { background: "rgba(0, 0, 0, 0)", channels: 4, height: 512, width: 512 } })
    .png()
    .toBuffer();
}
