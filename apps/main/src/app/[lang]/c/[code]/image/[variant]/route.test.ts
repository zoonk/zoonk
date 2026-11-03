import { certificateFixture } from "@zoonk/testing/fixtures/certificates";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getCertificateLinks } from "@zoonk/utils/certificate-links";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { GET as readImage } from "./route";

// Drawing needs Next's server runtime for next-intl, which Vitest doesn't run; these tests check
// which URLs serve and cache a picture, not the picture.
vi.mock("@/lib/certificates/certificate-image", () => ({
  renderCertificateImage: async () => new Response("png"),
}));

const ORIGIN = "http://localhost:9000";

function linkImageUrl({ code, name }: { code: string; name: string }) {
  const links = getCertificateLinks({
    code,
    completedOn: "2026-11-03",
    language: "en",
    level: null,
    origin: ORIGIN,
    recipientName: name,
    targetLanguage: null,
    title: null,
  });

  const url = new URL(links.imageUrls.link);
  url.searchParams.set("download", "1");
  return url;
}

function requestImage({ code, url }: { code: string; url: URL }) {
  return readImage(new NextRequest(url), {
    params: Promise.resolve({ code, lang: "en", variant: "link.png" }),
  });
}

describe("certificate image route", () => {
  it("sends a version made for another name to the current name's picture, uncached", async () => {
    const user = await userFixture({ name: "Ana Souza" });
    const { code } = await certificateFixture({ userId: user.id });
    const current = linkImageUrl({ code, name: "Ana Souza" });

    const redirect = await requestImage({
      code,
      url: linkImageUrl({ code, name: "Beatriz Souza" }),
    });

    expect(redirect.status).toBe(307);
    expect(redirect.headers.get("Location")).toBe(current.toString());
    expect(redirect.headers.get("Cache-Control")).toBe("no-store");

    const picture = await requestImage({ code, url: current });

    expect(picture.status).toBe(200);
    expect(picture.headers.get("Content-Disposition")).toMatch(/^attachment;/u);
  });
});
