import "server-only";
import { OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { openPdf } from "./render-pdf-page";

const IMAGE_PAINT_OPERATORS = new Set<number>([
  OPS.paintImageMaskXObject,
  OPS.paintImageMaskXObjectGroup,
  OPS.paintImageXObject,
  OPS.paintInlineImageXObject,
  OPS.paintInlineImageXObjectGroup,
  OPS.paintImageXObjectRepeat,
  OPS.paintImageMaskXObjectRepeat,
  OPS.paintSolidColorImageMask,
]);

export async function findPdfImagePages({
  bytes,
  candidates,
  limit,
}: {
  bytes: Uint8Array;
  candidates: number[];
  limit: number;
}): Promise<number[]> {
  if (candidates.length === 0) {
    return [];
  }

  // PDF.js takes ownership of the buffer, which the upload still needs for hashing.
  const loading = openPdf(new Uint8Array(bytes));

  try {
    const document = await loading.promise;
    const imagePages: number[] = [];

    // oxlint-disable no-await-in-loop -- Stop examining pages once the reading allocation is full.
    for (const index of candidates) {
      const page = await document.getPage(index + 1);
      const { fnArray } = await page.getOperatorList();

      if (fnArray.some((op) => IMAGE_PAINT_OPERATORS.has(op))) {
        imagePages.push(index);
      }

      if (imagePages.length === limit) {
        break;
      }
    }
    // oxlint-enable no-await-in-loop

    return imagePages;
  } finally {
    await loading.destroy();
  }
}
