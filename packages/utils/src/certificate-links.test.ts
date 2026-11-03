import { describe, expect, it } from "vitest";
import { formatCertificateCode, getCertificateLinks } from "./certificate-links";

const COURSE = {
  code: "K7QF2M9XHD4P",
  completedOn: "2026-03-09",
  language: "pt",
  level: null,
  recipientName: "Ana Souza",
  targetLanguage: null,
  title: "Física quântica do zero",
};

function getVersion(url: string): string | null {
  return new URL(url).searchParams.get("v");
}

describe(getCertificateLinks, () => {
  it("gives a renamed learner new image URLs, so a fresh share never shows the old name", () => {
    const before = getCertificateLinks(COURSE);
    const again = getCertificateLinks(COURSE);
    const renamed = getCertificateLinks({ ...COURSE, recipientName: "Ana Beatriz Souza" });
    const unnamed = getCertificateLinks({ ...COURSE, recipientName: null });

    expect(getVersion(again.imageUrls.print)).toBe(getVersion(before.imageUrls.print));
    expect(getVersion(renamed.imageUrls.print)).not.toBe(getVersion(before.imageUrls.print));
    expect(getVersion(unnamed.imageUrls.print)).not.toBe(getVersion(before.imageUrls.print));
  });

  it("draws images in the certificate's locale while the page opens in the visitor's", () => {
    const links = getCertificateLinks(COURSE);

    expect(links.path).toBe("/c/K7QF2M9XHD4P");
    expect(new URL(links.url).pathname).toBe("/c/K7QF2M9XHD4P");
    expect(new URL(links.imageUrls.print).pathname).toBe("/pt/c/K7QF2M9XHD4P/image/print.png");
    expect(new URL(links.imageUrls.link).pathname).toBe("/pt/c/K7QF2M9XHD4P/image/link.png");
    expect(new URL(links.imageUrls.post).pathname).toBe("/pt/c/K7QF2M9XHD4P/image/post.png");
  });

  it("fills LinkedIn's certification form with the course, issuer, month and credential", () => {
    const { linkedInUrl, url } = getCertificateLinks(COURSE);
    const params = new URL(linkedInUrl).searchParams;

    expect(Object.fromEntries(params)).toStrictEqual({
      certId: "K7QF-2M9X-HD4P",
      certUrl: url,
      issueMonth: "3",
      issueYear: "2026",
      name: "Física quântica do zero",
      organizationName: "Zoonk",
      startTask: "CERTIFICATION_NAME",
    });
  });

  it("names a language certificate by its language and level in the learner's language", () => {
    const { linkedInUrl } = getCertificateLinks({
      ...COURSE,
      language: "en",
      level: "B1",
      targetLanguage: "es",
      title: null,
    });

    expect(new URL(linkedInUrl).searchParams.get("name")).toBe("Spanish B1");
  });

  it("builds every link on the origin it's given", () => {
    const links = getCertificateLinks({ ...COURSE, origin: "https://preview.zoonk.dev" });
    const linkedIn = new URL(links.linkedInUrl).searchParams;

    expect(links.url).toBe("https://preview.zoonk.dev/c/K7QF2M9XHD4P");
    expect(new URL(links.imageUrls.print).origin).toBe("https://preview.zoonk.dev");
    expect(linkedIn.get("certUrl")).toBe("https://preview.zoonk.dev/c/K7QF2M9XHD4P");
  });
});

describe(formatCertificateCode, () => {
  it("groups a code in fours for reading aloud and typing from paper", () => {
    expect(formatCertificateCode("K7QF2M9XHD4P")).toBe("K7QF-2M9X-HD4P");
  });
});
