import { afterEach, describe, expect, it, vi } from "vitest";
import { renderPdfPage } from "./render-pdf-page";

const { getDocument } = vi.hoisted(() => ({ getDocument: vi.fn() }));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({ getDocument }));

describe(renderPdfPage, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("cancels a stalled render, destroys the document and leaves the page unreadable", async () => {
    vi.useFakeTimers();

    const rendering = Promise.withResolvers<null>();
    const cancel = vi.fn(() => rendering.reject(new Error("Rendering cancelled")));
    const destroy = vi.fn().mockResolvedValue(null);
    const toBuffer = vi.fn(() => Buffer.from("page"));

    getDocument.mockReturnValue({
      destroy,
      promise: Promise.resolve({
        canvasFactory: { create: () => ({ canvas: { toBuffer } }) },
        getPage: async () => ({
          getViewport: () => ({ height: 100, width: 100 }),
          render: () => ({ cancel, promise: rendering.promise }),
        }),
      }),
    });

    const page = renderPdfPage({ bytes: new Uint8Array(), index: 0 });

    await vi.advanceTimersByTimeAsync(30_000);
    rendering.resolve(null);

    await expect(page).resolves.toBeNull();
    expect(cancel).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
    expect(toBuffer).not.toHaveBeenCalled();
  });
});
