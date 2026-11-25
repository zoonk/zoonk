import "server-only";
import { createRequire } from "node:module";
import { dirname, join, sep } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { type DocumentImage } from "./parse-document";

export const MAX_PAGE_EDGE = 1800;
const MAX_EMBEDDED_IMAGE_PIXELS = 40_000_000;

const require = createRequire(import.meta.url);

export async function renderPdfPage({
  bytes,
  index,
}: {
  bytes: Uint8Array;
  index: number;
}): Promise<DocumentImage> {
  const assets = dirname(require.resolve("pdfjs-dist/package.json"));

  const loading = getDocument({
    cMapUrl: join(assets, "cmaps") + sep,
    data: bytes,
    maxImageSize: MAX_EMBEDDED_IMAGE_PIXELS,
    standardFontDataUrl: join(assets, "standard_fonts") + sep,
    stopAtErrors: true,
    wasmUrl: join(assets, "wasm") + sep,
  });

  try {
    const document = await loading.promise;
    const page = await document.getPage(index + 1);
    const { height, width } = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: MAX_PAGE_EDGE / Math.max(height, width) });

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- PDF.js uses its Node canvas factory here, whose methods its public types omit.
    const factory = document.canvasFactory as {
      create: (
        width: number,
        height: number,
      ) => {
        canvas: Parameters<typeof page.render>[0]["canvas"] & {
          toBuffer: (mediaType: "image/jpeg") => Buffer;
        };
      };
    };

    const { canvas } = factory.create(
      Math.max(1, Math.ceil(viewport.width)),
      Math.max(1, Math.ceil(viewport.height)),
    );

    await page.render({ canvas, viewport }).promise;
    return { data: canvas.toBuffer("image/jpeg").toString("base64"), mediaType: "image/jpeg" };
  } finally {
    await loading.destroy();
  }
}
