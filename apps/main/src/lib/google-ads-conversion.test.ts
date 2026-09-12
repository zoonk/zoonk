import { afterEach, describe, expect, it, vi } from "vitest";
import { sendGoogleAdsConversion } from "./google-ads-conversion";

function pixelFixture() {
  const images: { referrerPolicy: string; src: string }[] = [];

  vi.stubGlobal(
    "Image",
    class {
      referrerPolicy = "";
      src = "";
      constructor() {
        images.push(this);
      }
    },
  );

  return images;
}

describe("Google Ads conversion privacy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sends only the configured account and action, without page context or a persistent script", () => {
    const images = pixelFixture();
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_SUBSCRIPTION_CONVERSION_ID", "AW-123456789/Existing_Label");
    vi.stubGlobal("location", { href: "https://zoonk.com/subscription?next=private" });
    sendGoogleAdsConversion();
    sendGoogleAdsConversion();
    expect(images).toHaveLength(2);
    expect(images[0]?.referrerPolicy).toBe("no-referrer");
    const url = new URL(images[0]!.src);

    expect(url.origin + url.pathname).toBe(
      "https://www.googleadservices.com/pagead/conversion/123456789/",
    );

    expect(Object.fromEntries(url.searchParams)).toStrictEqual({
      guid: "ON",
      label: "Existing_Label",
      random: expect.any(String),
      script: "0",
    });

    expect(images[0]?.src).not.toBe(images[1]?.src);
  });

  it.each([undefined, "", "AW-123456789", "G-123456789/label", "AW-123456789/"])(
    "does not invent a missing or unsupported conversion label: %s",
    (destination) => {
      const images = pixelFixture();
      vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_SUBSCRIPTION_CONVERSION_ID", destination);
      sendGoogleAdsConversion();
      expect(images).toHaveLength(0);
    },
  );

  it("suppresses accidental calls on private learning pages", () => {
    const images = pixelFixture();
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_SUBSCRIPTION_CONVERSION_ID", "AW-123456789/Existing_Label");
    vi.stubGlobal("location", { href: "https://zoonk.com/b/me/c/private" });
    sendGoogleAdsConversion();
    expect(images).toHaveLength(0);
  });
});
