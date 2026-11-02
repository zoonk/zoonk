import { type BrowserContextOptions } from "@playwright/test";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const TOUCH = { hasTouch: true, isMobile: true };

export const VIEWPORT_NAMES = [
  "phone",
  "tablet",
  "tablet-landscape",
  "laptop",
  "desktop",
  "wide",
] as const;

export type ViewportName = (typeof VIEWPORT_NAMES)[number];

export const SCHEMES = ["light", "dark"] as const;
export type Scheme = (typeof SCHEMES)[number];

export function pick<T extends string>(list: string, allowed: readonly T[], name: string): T[] {
  return list.split(",").map((item) => {
    const match = allowed.find((candidate) => candidate === item.trim());

    if (!match) {
      throw new Error(`Unknown ${name} "${item}". Use ${allowed.join(", ")}.`);
    }

    return match;
  });
}

export const VIEWPORTS: Record<ViewportName, BrowserContextOptions> = {
  desktop: { viewport: { height: 1080, width: 1920 } },
  laptop: { viewport: { height: 900, width: 1440 } },
  phone: {
    ...TOUCH,
    deviceScaleFactor: 3,
    userAgent: IPHONE,
    viewport: { height: 844, width: 390 },
  },
  tablet: {
    ...TOUCH,
    deviceScaleFactor: 2,
    userAgent: IPAD,
    viewport: { height: 1180, width: 820 },
  },
  "tablet-landscape": {
    ...TOUCH,
    deviceScaleFactor: 2,
    userAgent: IPAD,
    viewport: { height: 820, width: 1180 },
  },
  wide: { viewport: { height: 1440, width: 2560 } },
};

/** Lighthouse's mobile throttling: a mid-range phone's CPU on a slow 4G network. */
export const THROTTLING = {
  cpuRate: 4,
  network: { downloadThroughput: 204_800, latency: 150, offline: false, uploadThroughput: 96_000 },
};
