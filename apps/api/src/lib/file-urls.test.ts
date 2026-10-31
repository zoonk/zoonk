import { API_URL, MAIN_URL } from "@zoonk/utils/url";
import { describe, expect, it } from "vitest";
import { toApiImageUrl, withApiImageUrls } from "./file-urls";

const CDN_IMAGE = "https://example.public.blob.vercel-storage.com/library/images/cell.webp";
const PRIVATE_IMAGE = "https://store.private.blob.vercel-storage.com/images/user-1/cell.webp";

describe(toApiImageUrl, () => {
  it("gives a path the web app serves its origin, so a client without a page can load it", () => {
    expect(toApiImageUrl("/catalog/chapters/science.webp")).toBe(
      new URL("/catalog/chapters/science.webp", MAIN_URL).toString(),
    );
  });

  it("keeps a public file's address and points a private one at the owner's file route", () => {
    expect(toApiImageUrl(CDN_IMAGE)).toBe(CDN_IMAGE);
    expect(toApiImageUrl(PRIVATE_IMAGE)).toBe(`${API_URL}/v1/files/images/user-1/cell.webp`);
  });
});

describe(withApiImageUrls, () => {
  it("rewrites every image a body nests and leaves everything else as it was", () => {
    const answeredAt = new Date("2026-10-07T12:00:00.000Z");

    const body = {
      answeredAt,
      courses: [{ imageUrl: "/catalog/chapters/math.webp", title: "Algebra" }],
      mindMap: { image: { thumbnailUrl: PRIVATE_IMAGE, url: CDN_IMAGE } },
      questions: [
        { image: { alt: "A cell", url: PRIVATE_IMAGE, width: 640 }, question: "What's this?" },
        { image: null, question: "/not/an/image" },
      ],
      user: { image: CDN_IMAGE },
    };

    expect(withApiImageUrls(body)).toStrictEqual({
      answeredAt,
      courses: [
        { imageUrl: new URL("/catalog/chapters/math.webp", MAIN_URL).toString(), title: "Algebra" },
      ],
      mindMap: {
        image: { thumbnailUrl: `${API_URL}/v1/files/images/user-1/cell.webp`, url: CDN_IMAGE },
      },
      questions: [
        {
          image: { alt: "A cell", url: `${API_URL}/v1/files/images/user-1/cell.webp`, width: 640 },
          question: "What's this?",
        },
        { image: null, question: "/not/an/image" },
      ],
      user: { image: CDN_IMAGE },
    });
  });
});
